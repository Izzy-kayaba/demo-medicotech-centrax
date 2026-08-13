const page = document.body.dataset.page || "";
const pages = {
  home: "index.html",
  about: "about.html",
  services: "professional-services.html",
  news: "news.html",
  contact: "contact.html",
  partners: "partners.html",
  ethics: "ethics.html",
  howItWorks: "how-it-works.html",
  industries: "industries.html",
};
const current = (key) => (page === key ? ' aria-current="page"' : "");

document.querySelector("#site-header").innerHTML = `
  <a class="skip-link" href="#main">Skip to main content</a>
  <div class="site-header"><div class="header-inner">
    <a class="brand" href="${pages.home}" aria-label="MedicoTech home"><img src="assets/medicotech-logo.png" alt="MedicoTech — Powering Healthcare Productivity"></a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-nav" aria-label="Open navigation">☰</button>
    <nav class="nav" id="primary-nav" aria-label="Primary navigation">
      <ul>
        <li><a href="${pages.home}"${current("home")}>Home</a></li>
        <li class="nav__item--dropdown">
          <button class="nav__dropdown-button" type="button" aria-expanded="false">About Us</button>
          <ul class="nav__dropdown">
            <li><a href="${pages.about}"${current("about")}>About MedicoTech</a></li>
            <li><a href="${pages.partners}"${current("partners")}>Partners &amp; Collaborators</a></li>
            <li><a href="${pages.ethics}"${current("ethics")}>Ethics &amp; Compliance</a></li>
          </ul>
        </li>
        <li><a href="${pages.services}"${current("services")}>Services</a></li>
        <li><a href="${pages.industries}"${current("industries")}>Industries</a></li>
        <li><a href="${pages.howItWorks}"${current("howItWorks")}>How It Works</a></li>
        <li><a href="${pages.news}"${current("news")}>News</a></li>
        <li><a href="${pages.contact}"${current("contact")}>Contact Us</a></li>
      </ul>
      <a class="button login-button" href="#" aria-label="Login to MedicoTech">Login <span aria-hidden="true">↗</span></a>
    </nav>
  </div>
</div>`;

const heroImages = document.querySelectorAll(".home-hero__image");

if (heroImages.length > 1) {
  let current = 0;

  setInterval(() => {
    heroImages[current].classList.remove("is-active");

    current = (current + 1) % heroImages.length;

    heroImages[current].classList.add("is-active");
  }, 3000);
}


document.querySelector("#site-footer").innerHTML = `
  <footer class="site-footer">
    <div class="container footer-main">
      <div class="footer-brand"><img class="footer-logo" src="assets/medicotech-logo.png" alt="MedicoTech"></div>
      <div><h3>Quick Link</h3><ul><li><a href="${pages.about}">About</a></li><li><a href="${pages.services}">Services</a></li><li><a href="${pages.howItWorks}">How It Works</a></li><li><a href="${pages.industries}">Industries</a></li><li><a href="${pages.contact}">Contact</a></li></ul></div>
      <div><h3>Contact Us</h3><ul class="footer-contact"><li><span aria-hidden="true">☎</span><a href="tel:+27609411024">+27-60-941-1024</a></li><li><span aria-hidden="true">✉</span><a href="mailto:info@tptmedicotech.com">info@tptmedicotech.com</a></li><li><span aria-hidden="true">●</span><span>Johannesburg</span></li></ul></div>
      <div><h3>Recent News</h3><ul><li><a href="${pages.news}">MedicoTech</a></li><li><a href="${pages.news}">Matric Stress</a></li><li><a href="${pages.news}">When Money Hurts</a></li></ul></div>
    </div>
    <div class="container footer-bottom"><p>Copyright &copy; <span id="year"></span> TPTMedico_Tech. All Rights Reserved.</p><p>Developed By: Centrax Digital</p><p><a href="${pages.ethics}">Terms &amp; Conditions</a> <span aria-hidden="true">|</span> <a href="${pages.ethics}">Privacy Policy</a></p></div>
  </footer>`;

document.querySelector("#year").textContent = new Date().getFullYear();
const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".nav");
menuToggle.addEventListener("click", () => {
  const open = nav.classList.toggle("is-open");
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute(
    "aria-label",
    open ? "Close navigation" : "Open navigation",
  );
  menuToggle.textContent = open ? "×" : "☰";
});
document.querySelectorAll(".nav__dropdown-button").forEach((button) => {
  button.addEventListener("click", () => {
    const item = button.closest(".nav__item--dropdown");
    const open = item.classList.toggle("is-open");
    button.setAttribute("aria-expanded", String(open));
  });
});

const revealItems = document.querySelectorAll(
  "main .section > .container, .image-band__block, .contact-layout",
);
if (revealItems.length && "IntersectionObserver" in window) {
  document.body.classList.add("motion-ready");
  revealItems.forEach((item) => item.classList.add("reveal"));
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
  );
  revealItems.forEach((item) => revealObserver.observe(item));
}

const form = document.querySelector(".form");
if (form) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = form.querySelector(".form-note");
    message.textContent =
      "Thank you. This prototype form is ready to be connected to the WordPress form handler.";
    message.setAttribute("role", "status");
  });
}
