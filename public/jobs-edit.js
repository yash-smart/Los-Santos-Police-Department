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
function getDate(date) {
    let day = date.getDate();
    let month = date.getMonth()+1;
    let year = date.getFullYear();
    day = day<10?`0${day}`:day;
    month = month<10?`0${month}`:month;
    year = year<10?`0${year}`:year;
    return `${day}/${month}/${year}`;
}
let timefields = document.getElementsByClassName('time');
for (let i=0;i<timefields.length;i++) {
    let iterator = timefields[i].getAttribute('iterator');
    let type = timefields[i].getAttribute('type');
    let data = new Date(document.getElementById(iterator+type).textContent);
    let add = timefields[i].getAttribute('add');
    if (add == 'datetime') {
        timefields[i].textContent += getDateTime(data);
    } else {
        timefields[i].textContent += getDate(data);
    }
}   