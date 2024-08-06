const socket = new WebSocket("wss://los-santos-police-department.onrender.com");
socket.addEventListener("open", (event) => {
    console.log('Connected to server')
    socket.send('5');
});
function isOpen(ws) {
    return ws.readyState === ws.OPEN;
}
socket.addEventListener("message", (event) => {
    let message = ''+event.data;
    console.log('Message Received: '+message);
    if (message[0] == '6') {
        let tip_data = JSON.parse(message.slice(1));
        if (tip_data.length == 3) {
            let tip_element = document.createElement('div');
            tip_element.classList.add('tip');
            tip_element.classList.add('animated-container');
            let tip_para = document.createElement('p');
            tip_para.textContent = tip_data[0];
            let file = document.createElement('a');
            file.href = tip_data[2];
            file.textContent = 'File Attached'
            let posted_on_para = document.createElement('p');
            posted_on_para.classList.add('posted_on');
            posted_on_para.textContent = 'Posted On: '+new Date(tip_data[1]).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' , hour:'numeric', minute: "numeric"});
            tip_element.append(tip_para);
            tip_element.append(file);
            tip_element.append(posted_on_para);
            let hr = document.createElement('hr');
            tip_element.append(hr);
            document.querySelector('.tips').prepend(tip_element);
        } else {
            let tip_element = document.createElement('div');
            tip_element.classList.add('tip');
            let tip_para = document.createElement('p');
            tip_para.textContent = tip_data[0];
            let posted_on_para = document.createElement('p');
            posted_on_para.classList.add('posted_on');
            posted_on_para.textContent = 'Posted On: '+new Date(tip_data[1]).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' , hour:'numeric', minute: "numeric"});
            tip_element.append(tip_para);
            tip_element.append(posted_on_para);
            let hr = document.createElement('hr');
            tip_element.append(hr);
            document.querySelector('.tips').prepend(tip_element);
        }
    }
})