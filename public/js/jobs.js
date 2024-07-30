function updateList() {
    let title = document.getElementById('Title').value;
    let description = document.getElementById('Description').value;
    let newData = [];
    for (let i=0;i<job_data.length;i++) {
        if (job_data[i].title.toLowerCase().includes(title.toLowerCase()) && job_data[i].description.toLowerCase().includes(description.toLowerCase())) {
            newData.push(job_data[i]);
        }
    }
    let jobs_elements = document.querySelectorAll('.job');
    for (let i=0;i<jobs_elements.length;i++) {
        jobs_elements[i].remove();
    }
    let job_listings = document.querySelector('.job-listings');
    for (let i=0;i<newData.length;i++) {
        let new_job_element = document.createElement('article');
        new_job_element.classList.add('job');
        let h3 = document.createElement('h3');
        h3.textContent = newData[i].title;
        h3.classList.add('ownFont')
        let jobDetailsElement = document.createElement('div');
        jobDetailsElement.classList.add('job-details');
        let descriptionElement = document.createElement('p');
        descriptionElement.style.whiteSpace = 'pre-wrap';
        descriptionElement.innerHTML = '<strong>Description:</strong><br>'+newData[i].description+'</br>';
        let departmentElement = document.createElement('p');
        departmentElement.innerHTML = '<strong>Department:</strong> '+newData[i].department;
        let location_type_element = document.createElement('p');
        location_type_element.innerHTML = '<strong>Location Type:</strong> '+newData[i].location_type;
        let location_element = document.createElement('p');
        location_element.innerHTML = '<strong>Location:</strong> '+newData[i].location;
        let type_element = document.createElement('p');
        type_element.innerHTML = '<strong>Type:</strong> '+newData[i].type;
        jobDetailsElement.append(descriptionElement);
        jobDetailsElement.append(departmentElement);
        jobDetailsElement.append(location_type_element);
        jobDetailsElement.append(location_element);
        jobDetailsElement.append(type_element);
        let posted_on_element = document.createElement('p');
        posted_on_element.classList.add('posted-on');
        posted_on_element.textContent = 'Posted on: '+new Date(newData[i].posted_on).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        let last_apply_date_element = document.createElement('p');
        last_apply_date_element.classList.add('posted-on');
        last_apply_date_element.textContent = 'Last Apply Date: '+new Date(newData[i].last_apply_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        let ApplyButton = document.createElement('a');
        ApplyButton.href = 'apply-job/'+newData[i].id;
        ApplyButton.innerHTML = '<button class="apply-button">Apply</button>';
        let saveForLaterButton = document.createElement('button');
        saveForLaterButton.classList.add('save-button');
        saveForLaterButton.setAttribute('data-job-id',newData[i].id);
        saveForLaterButton.textContent = 'Save for Later';
        saveForLaterButton.style.marginLeft = '10px';
        let jobActions = document.createElement('div');
        jobActions.classList.add('job-actions');
        jobActions.append(ApplyButton);
        jobActions.append(saveForLaterButton);
        new_job_element.append(h3);
        new_job_element.append(jobDetailsElement);
        new_job_element.append(posted_on_element);
        new_job_element.append(last_apply_date_element);
        new_job_element.append(jobActions);
        job_listings.append(new_job_element);
    }
}
let job_data = JSON.parse(document.getElementById('job_data').textContent);
// console.log(job_data)
document.getElementById('Title').addEventListener('keyup',updateList);
document.getElementById('Description').addEventListener('keyup',updateList);
function saveJob(jobId) { 
    fetch('/save-job', {
        method: 'POST',
        mode:'cors',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({jobId:jobId}),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Job saved for later!');
        } else {
            alert('Error saving job: ' + data.error);
        }
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}

document.querySelectorAll('.save-button').forEach(button => {
    button.addEventListener('click', (event) => {
        const jobId = event.target.getAttribute('data-job-id');
        if (jobId) {
            saveJob(jobId);
        } else {
            console.log('Job ID not found');
            alert('Job ID not found.');
        }
    });
});