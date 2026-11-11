export function confirmAction(message, {title:heading='작업 확인', cancelLabel='취소', acceptLabel='확인', extraLabel=null, defaultAction='cancel'} = {}) {
  return new Promise(resolve=>{
    const previous=document.activeElement;
    const dialog=document.createElement('dialog');dialog.className='mir-confirm';
    const title=document.createElement('h2');title.textContent=heading;
    const text=document.createElement('p');text.textContent=message;
    const actions=document.createElement('div');actions.className='modal-actions';
    const cancel=document.createElement('button');cancel.textContent=cancelLabel;
    const accept=document.createElement('button');accept.textContent=acceptLabel;accept.className='primary';
    if(extraLabel){cancel.textContent='×';cancel.className='confirm-close';cancel.setAttribute('aria-label','계속 편집');title.append(cancel);}else actions.append(cancel);if(extraLabel){const extra=document.createElement('button');extra.textContent=extraLabel;extra.className='primary';extra.onclick=()=>{result='save';dialog.close();};actions.append(extra);accept.className='';}actions.append(accept);dialog.append(title,text,actions);document.body.append(dialog);
    let result=false;
    cancel.onclick=()=>dialog.close();accept.onclick=()=>{result=true;dialog.close();};
    dialog.onclose=()=>{dialog.remove();if(previous?.isConnected)previous.focus();resolve(result);};
    dialog.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      const buttons = [...dialog.querySelectorAll('button:not(:disabled)')];
      const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
      const index = buttons.indexOf(document.activeElement);
      event.preventDefault();
      buttons[(index + direction + buttons.length) % buttons.length].focus();
    });
    dialog.showModal();
    (defaultAction === 'accept' ? accept : cancel).focus();
  });
}
