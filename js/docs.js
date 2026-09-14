document.querySelectorAll('.nav-item[data-target]').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    const targetId = item.dataset.target;
    document.querySelectorAll('.section').forEach(s => {
      s.classList.remove('open');
      s.querySelector('.section-header').classList.remove('open');
    });
    const target = document.getElementById(targetId);
    if (target) {
      target.classList.add('open');
      target.querySelector('.section-header').classList.add('open');
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

document.querySelectorAll('.section-header').forEach(header => {
  header.addEventListener('click', () => {
    const section = header.closest('.section');
    section.classList.toggle('open');
    header.classList.toggle('open');
  });
});
