const flaskStatus = document.querySelector("#flask-status");
const flaskMessage = document.querySelector("#flask-message");
const refreshButton = document.querySelector("#refresh-status");

async function refreshStatus() {
  flaskStatus.textContent = "Checking...";
  flaskMessage.textContent = "Waiting for Flask API response.";

  try {
    const response = await fetch("/health");
    const data = await response.json();

    flaskStatus.textContent = data.status;
    flaskMessage.textContent = data.message
      ? data.message
      : "No message received.";
  } catch (error) {
    flaskStatus.textContent = "error";
    flaskMessage.textContent = "The browser could not reach the Flask API.";
  }
}

refreshButton.addEventListener("click", refreshStatus);
refreshStatus();
