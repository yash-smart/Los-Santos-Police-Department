document.addEventListener("DOMContentLoaded", () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const element = entry.target;
            if (entry.isIntersecting) {
                element.style.transitionDelay = element.getAttribute('data-delay');
                element.classList.add("in-view");
            } else {
                element.classList.remove("in-view");
            }
        });
    }, { threshold: 0.1 });

    const elements = document.querySelectorAll(".blur-fade");
    elements.forEach(element => {
        observer.observe(element);
    });

    // New part to handle the typewriter cursor
    const typewriter = document.querySelector('.typewriter h1');
    typewriter.addEventListener('animationend', () => {
        typewriter.style.borderRight = 'none';
    });
});
