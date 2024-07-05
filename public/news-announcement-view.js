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
let posted_on = new Date(document.getElementById('posted_on_data').textContent);
document.getElementById('posted_on').textContent+=getDateTime(posted_on);
let posted_on_array = document.getElementsByClassName('posted_on');
for (let i=0;i<posted_on_array.length;i++) {
    let id = posted_on_array[i].getAttribute('iterator');
    let date = new Date(posted_on_array[i].textContent);
    document.getElementById('p'+id).textContent += getDateTime(date);
}