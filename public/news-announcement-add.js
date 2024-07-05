function add_text() {
    document.getElementById('add').remove();
    document.getElementById('add_text').style.display = 'block';
    // document.getElementById('add_image').style.display = 'block';
}
function add_image() {
    document.getElementById('add').remove();
    document.getElementById('add_image').style.display = 'block';
}
function add_video() {
    document.getElementById('add').remove();
    document.getElementById('add_video').style.display = 'block';
}
function update() {
    let ordernumber = this.getAttribute('order_number');
    document.getElementById('updatedelete'+ordernumber).remove();
    document.getElementById('u'+ordernumber).style.display = 'block';
}
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

document.getElementById('add_text_button').addEventListener('click',add_text);
document.getElementById('add_image_button').addEventListener('click',add_image);
document.getElementById('add_video_button').addEventListener('click',add_video);
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
let update_buttons = document.getElementsByClassName('update');
for (let i=0;i<update_buttons.length;i++) {
    update_buttons[i].addEventListener('click',update);
}
let posted_on = new Date(document.getElementById('posted_on_data').textContent);
document.getElementById('posted_on').textContent+=getDateTime(posted_on);
let posted_on_array = document.getElementsByClassName('posted_on');
for (let i=0;i<posted_on_array.length;i++) {
    let id = posted_on_array[i].getAttribute('iterator');
    let date = new Date(posted_on_array[i].textContent);
    document.getElementById('p'+id).textContent += getDateTime(date);
}