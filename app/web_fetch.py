"""Bounded public HTTPS fetches with DNS pinning and redirect revalidation."""
import http.client
import ipaddress
import socket
import ssl
import time
from urllib.parse import urljoin, urlsplit, urlunsplit


class FetchError(ValueError):
    pass


def public_target(url):
    try:
        parts = urlsplit(url)
        port = parts.port
    except ValueError as exc:
        raise FetchError("INVALID_URL") from exc
    if parts.scheme != "https" or not parts.hostname or parts.username or parts.password or port not in (None, 443):
        raise FetchError("PUBLIC_HTTPS_REQUIRED")
    if len(url) > 2000:
        raise FetchError("URL_TOO_LONG")
    host = parts.hostname.encode("idna").decode("ascii")
    if host.lower() == "localhost" or host.lower().endswith((".localhost", ".local", ".internal")):
        raise FetchError("PRIVATE_TARGET_BLOCKED")
    addresses = {item[4][0] for item in socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)}
    if not addresses or any(not ipaddress.ip_address(address).is_global for address in addresses):
        raise FetchError("PRIVATE_TARGET_BLOCKED")
    path = urlunsplit(("", "", parts.path or "/", parts.query, ""))
    return host, sorted(addresses)[0], path


class PinnedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self, host, address, timeout):
        super().__init__(host, timeout=timeout, context=ssl.create_default_context())
        self.address = address

    def connect(self):
        sock = socket.create_connection((self.address, 443), timeout=self.timeout)
        try:
            self.sock = self._context.wrap_socket(sock, server_hostname=self.host)
        except Exception:
            sock.close()
            raise


def fetch_public(url, *, max_bytes=10_000_000, timeout=15, headers=None):
    original_host = urlsplit(url).hostname
    deadline = time.monotonic() + timeout
    for _ in range(4):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise FetchError("FETCH_TIMEOUT")
        host, address, path = public_target(url)
        connection = PinnedHTTPSConnection(host, address, remaining)
        request_headers = {"Host": host, "User-Agent": "CircuitAgentResearch/0.2", "Accept": "application/pdf,text/html,application/json,text/plain", "Accept-Encoding": "identity"}
        # Provider secrets must never be forwarded through cross-host redirects.
        if headers and host == original_host:
            request_headers.update(headers)
        try:
            connection.request("GET", path, headers=request_headers)
            transport_socket = connection.sock
            response = connection.getresponse()
            if response.status in (301, 302, 303, 307, 308):
                location = response.getheader("Location")
                if not location:
                    raise FetchError("REDIRECT_WITHOUT_LOCATION")
                url = urljoin(url, location)
                continue
            if response.status != 200:
                raise FetchError(f"UPSTREAM_HTTP_{response.status}")
            if response.getheader("Content-Encoding", "identity").lower() not in ("identity", ""):
                raise FetchError("COMPRESSED_RESPONSE_UNSUPPORTED")
            length = response.getheader("Content-Length")
            if length and int(length) > max_bytes:
                raise FetchError("DOCUMENT_TOO_LARGE")
            chunks, size = [], 0
            while True:
                if response.isclosed():
                    break
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise FetchError("FETCH_TIMEOUT")
                if transport_socket:
                    transport_socket.settimeout(remaining)
                chunk = response.read1(min(65536, max_bytes + 1 - size))
                if not chunk:
                    break
                chunks.append(chunk)
                size += len(chunk)
                if size > max_bytes:
                    raise FetchError("DOCUMENT_TOO_LARGE")
            body = b"".join(chunks)
            return {"url": url, "content_type": response.getheader("Content-Type", ""), "body": body}
        except (OSError, http.client.HTTPException, ValueError) as exc:
            if isinstance(exc, FetchError):
                raise
            raise FetchError("FETCH_FAILED") from exc
        finally:
            connection.close()
    raise FetchError("TOO_MANY_REDIRECTS")
