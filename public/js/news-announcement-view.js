function getDateTime(date) {
    let day = date.getDate();
    let month = date.getMonth()+1;
    let year = date.getFullYear();
    let hours = date.getHours();
    let minutes = date.getMinutes();
    day = day<10?`0${day}`:day;
    month = month<10?`0${month}`:month;
    year = year<10?`0${year}`:year;
    hours = hours<10?`0${hours}`:hours;
    minutes = minutes<10?`0${minutes}`:minutes;
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}
let likes = parseInt(document.getElementById('initial_likes').textContent);
let comments = parseInt(document.getElementById('initial_comments').textContent);
let images = document.getElementsByClassName('image');
for (let i=0;i<images.length;i++) {
    let width = images[i].offsetWidth;
    let height = images[i].offsetHeight;
    console.log(width);
    console.log(height);
    if (height>width) {
        images[i].style.height = '500px';
    } else {
        images[i].style.width = '500px'
    }
}
let news_id = document.getElementById('news_id_data').textContent;
const socket = new WebSocket("wss://los-santos-police-department.onrender.com");
socket.addEventListener("open", (event) => {
    console.log('Connected to server')
    socket.send('1'+news_id);
});
function isOpen(ws) {
    return ws.readyState === ws.OPEN;
}
socket.addEventListener("message", (event) => {
    let message = ''+event.data;
    console.log('Message Received: '+message);
    if (message[0] == '3') {
        likes += 1;
        document.getElementById('likes').textContent = 'Likes: '+likes;
    } else if (message[0] == '2') {
        likes -= 1;
        document.getElementById('likes').textContent = 'Likes: '+likes;
    } else if (message[0] == '4') {
        let data = JSON.parse(message.slice(1));
        comments += 1;
        document.getElementById('comments_count').textContent = 'Comments: '+comments;
        let comment = document.createElement('div');
        comment.style.margin = '20px';
        let user = document.createElement('h4');
        user.textContent = data[0];
        let comment_element = document.createElement('p');
        comment_element.textContent = data[1];
        let datetime_element = document.createElement('p');
        datetime_element.textContent = 'Posted on: '+getDateTime(new Date(data[2]));
        comment.append(user);
        comment.append(comment_element);
        comment.append(datetime_element);
        document.getElementById('comments').prepend(comment);
    }
})