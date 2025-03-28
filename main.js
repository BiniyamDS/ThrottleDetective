// Add functionality to stop the test
let testInterval;
let elapsedTimeInterval; // Interval for updating the elapsed time

document.getElementById('start-test').addEventListener('click', function() {
    const resultsDiv = document.getElementById('test-results');
    const stopButton = document.getElementById('stop-test');
    resultsDiv.style.display = 'block';
    stopButton.style.display = 'inline-block';
});

// Modify the "Start Test" button click event to store the interval ID
document.getElementById('start-test').addEventListener('click', () => {
  // Immediately run a test
  runDownloadTest();

  // Show test results section
  document.getElementById('test-results').style.display = 'block';

  // Schedule to run the test every 30 minutes (30 * 60 * 1000 ms)
  testInterval = setInterval(runDownloadTest, 30 * 60 * 1000);

  // Start the elapsed time timer
  const elapsedTimeEl = document.getElementById('elapsed-time');
  let elapsedSeconds = 0;
  elapsedTimeEl.textContent = '00:00'; // Reset timer display
  elapsedTimeInterval = setInterval(() => {
    elapsedSeconds++;
    const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
    const seconds = (elapsedSeconds % 60).toString().padStart(2, '0');
    elapsedTimeEl.textContent = `${minutes}:${seconds}`;
  }, 1000);
});

// Add functionality to stop the test
document.getElementById('stop-test').addEventListener('click', function() {
    const resultsDiv = document.getElementById('test-results');
    resultsDiv.style.display = 'none';
    this.style.display = 'none'; // Correctly hides the stop button itself
});

document.getElementById('stop-test').addEventListener('click', () => {
  if (testInterval) {
    clearInterval(testInterval);
    testInterval = null;
  }
  const statusEl = document.getElementById('download-status');
  statusEl.textContent = 'Test stopped';

  // Stop the elapsed time timer
  if (elapsedTimeInterval) {
    clearInterval(elapsedTimeInterval);
    elapsedTimeInterval = null;
  }
});

// URL of a 100 MB file – ensure the file supports CORS!
const FILE_URL = 'http://cachefly.cachefly.net/100mb.test';
// Size of the file in bytes (adjust if needed, here 100 MB)
const FILE_SIZE_BYTES = 100 * 1024 * 1024;

// Key for localStorage
const STORAGE_KEY = 'throttleTestData';

// Function to run the download test
async function runDownloadTest() {
  const statusEl = document.getElementById('download-status');
  const downloadSpeedEl = document.getElementById('download-speed');
  const progressBar = document.getElementById('download-progress');
  const progressText = document.getElementById('progress-text');

  // Reset and show progress bar
  progressBar.value = 0;
  progressBar.style.display = 'block';
  progressText.textContent = '0%';

  statusEl.textContent = 'Downloading...';
  // Start time
  const startTime = performance.now();

  try {
    // Start the download via fetch.
    const response = await fetch(FILE_URL, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Use the ReadableStream interface to monitor progress
    const reader = response.body.getReader();
    let receivedLength = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedLength += value.length;
      // Update progress indicator (calculate percentage)
      let percent = (receivedLength / FILE_SIZE_BYTES) * 100;
      progressBar.value = percent;
      progressText.textContent = `${percent.toFixed(2)}%`;
    }
    // End time after the stream has finished
    const endTime = performance.now();
    const durationSec = (endTime - startTime) / 1000;

    // Compute speed in Mbps: (FILE_SIZE_BYTES * 8 bits) / (duration in seconds * 1e6)
    const speedMbps = ((FILE_SIZE_BYTES) / (durationSec * 1e6)).toFixed(2);

    // Update UI
    downloadSpeedEl.textContent = `${speedMbps} Mbps`;
    statusEl.textContent = 'Completed';
    progressBar.style.display = 'none';
    progressText.textContent = '';

    // Stop the elapsed time timer
    if (elapsedTimeInterval) {
      clearInterval(elapsedTimeInterval);
      elapsedTimeInterval = null;
    }

    // Update local storage with new test data
    saveTestResult({
      timestamp: Date.now(),
      speedMbps: Number(speedMbps),
      dataDownloadedMB: FILE_SIZE_BYTES / (1024 * 1024)
    });

    // Update test results display (total and average)
    updateTestResultsUI();
    // Update the chart with the new data
    updateChart();

  } catch (error) {
    console.error('Download error:', error);
    statusEl.textContent = 'Error during download';
    progressBar.style.display = 'none';
    progressText.textContent = '';

    // Stop the elapsed time timer in case of an error
    if (elapsedTimeInterval) {
      clearInterval(elapsedTimeInterval);
      elapsedTimeInterval = null;
    }
  }
}

// Save test results to localStorage
function saveTestResult(result) {
  const stored = localStorage.getItem(STORAGE_KEY);
  const data = stored ? JSON.parse(stored) : [];
  data.push(result);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Update the test results section (total data and average speed)
function updateTestResultsUI() {
  const stored = localStorage.getItem(STORAGE_KEY);
  const data = stored ? JSON.parse(stored) : [];
  if (data.length === 0) return;

  // Total data downloaded (in MB)
  const totalData = data.reduce((sum, curr) => sum + curr.dataDownloadedMB, 0);
  // Average speed
  const avgSpeed = (data.reduce((sum, curr) => sum + curr.speedMbps, 0) / data.length).toFixed(2);

  document.getElementById('total-data').textContent = `${totalData} MB`;
  document.getElementById('average-speed').textContent = `${avgSpeed} Mbps`;
}

// Set up chart using Chart.js
let chart;  // global chart instance
function updateChart() {
  const stored = localStorage.getItem(STORAGE_KEY);
  const data = stored ? JSON.parse(stored) : [];
  if (!data.length) return;

  // Prepare data for the chart: timestamps (x-axis) and speeds (y-axis)
  const labels = data.map(item => {
    const d = new Date(item.timestamp);
    return d.toLocaleTimeString();
  });
  const speeds = data.map(item => item.speedMbps);

  const ctx = document.getElementById('speedChart').getContext('2d');

  if (chart) {
    // If chart exists, update its data
    chart.data.labels = labels;
    chart.data.datasets[0].data = speeds;
    chart.update();
  } else {
    // Create the chart
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Download Speed (Mbps)',
          data: speeds,
          borderColor: 'rgba(75, 192, 192, 1)',
          fill: false,
          tension: 0.1
        }]
      },
      options: {
        scales: {
          x: { title: { display: true, text: 'Time' } },
          y: { title: { display: true, text: 'Speed (Mbps)' } }
        }
      }
    });
  }
}

// On page load, update the UI and chart in case data exists
window.addEventListener('load', () => {
  updateTestResultsUI();
  updateChart();
});
