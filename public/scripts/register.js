let currentStep = 0;

const steps = document.querySelectorAll(".step-page");
const indicators = document.querySelectorAll(".step");

function showStep(index){
  steps.forEach((s,i)=>{
    s.classList.toggle("active", i === index);
  });

  indicators.forEach((i,idx)=>{
    i.classList.toggle("active", idx === index);
  });
}

function nextStep(){
  if(currentStep < steps.length - 1){
    currentStep++;
    showStep(currentStep);
  }
}

function prevStep(){
  if(currentStep > 0){
    currentStep--;
    showStep(currentStep);
  }
}

// SUBMIT
document.getElementById("registerForm").addEventListener("submit", async (e)=>{
  e.preventDefault();

  const formData = new FormData(e.target);

  const data = Object.fromEntries(formData.entries());

  console.log("REGISTER DATA:", data);

  // тут потім:
  // fetch("/api/auth/register", {...})
});