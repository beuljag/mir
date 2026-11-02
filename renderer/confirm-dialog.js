export function confirmAction(message, {title:heading='작업 확인', cancelLabel='취소', acceptLabel='확인'} = {}) {
  return new Promise(resolve=>{
    const previous=document.activeElement;
    const dialog=document.createElement('dialog');dialog.className='mir-confirm';
    const title=document.createElement('h2');title.textContent=heading;
    const text=document.createElement('p');text.textContent=message;
    const actions=document.createElement('div');actions.className='modal-actions';
    const cancel=document.createElement('button');cancel.textContent=cancelLabel;
    const accept=document.createElement('button');accept.textContent=acceptLabel;accept.className='primary';
    actions.append(cancel,accept);dialog.append(title,text,actions);document.body.append(dialog);
    let result=false;
    cancel.onclick=()=>dialog.close();accept.onclick=()=>{result=true;dialog.close();};
    dialog.onclose=()=>{dialog.remove();if(previous?.isConnected)previous.focus();resolve(result);};
    dialog.showModal();cancel.focus();
  });
}
