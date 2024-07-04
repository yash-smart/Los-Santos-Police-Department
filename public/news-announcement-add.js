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