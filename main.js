let elapsedTimeInterval; // Interval for updating the elapsed time
let testInterval; // Interval for running tests repeatedly
let isTestRunning = false; // Flag to prevent overlapping tests
let currentDownloadController; // Controller to abort the current download

document.getElementById('start-test').addEventListener('click', function() {
    const resultsDiv = document.getElementById('test-results');
    resultsDiv.style.display = 'block';
});

// Modify the "Start Test" button click event
document.getElementById('start-test').addEventListener('click', () => {
  // Immediately run a test
  runDownloadTest();

  // Show test results section
  document.getElementById('test-results').style.display = 'block';

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

  // Show the Stop Test button and hide the Start Test button
  document.getElementById('start-test').style.display = 'none';
  document.getElementById('stop-test').style.display = 'inline-block';

  // Start running tests in a loop
  testInterval = setInterval(() => {
    if (!isTestRunning) {
      runDownloadTest();
    }
  }, 5000); // Run every 5 seconds
});

document.getElementById('stop-test').addEventListener('click', () => {
  // Stop the test loop
  if (testInterval) {
    clearInterval(testInterval);
    testInterval = null;
  }

  // Stop the elapsed time timer
  if (elapsedTimeInterval) {
    clearInterval(elapsedTimeInterval);
    elapsedTimeInterval = null;
  }

  // Abort the current download if running
  if (currentDownloadController) {
    currentDownloadController.abort();
    currentDownloadController = null;
  }

  // Reset UI
  document.getElementById('start-test').style.display = 'inline-block';
  document.getElementById('stop-test').style.display = 'none';
  document.getElementById('download-status').textContent = 'Idle';
  document.getElementById('download-progress').style.display = 'none';
  document.getElementById('progress-text').textContent = '';
});

// URL of a 10 MB file – ensure the file supports CORS!
const FILE_URL = 'http://cachefly.cachefly.net/10mb.test';
// Size of the file in bytes (adjusted to 10 MB)
const FILE_SIZE_BYTES = 10 * 1024 * 1024;

// Key for localStorage
const STORAGE_KEY = 'throttleTestData';

// Function to run the download test
async function runDownloadTest() {
  if (isTestRunning) return; // Prevent overlapping tests
  isTestRunning = true;

  const statusEl = document.getElementById('download-status');
  const downloadSpeedEl = document.getElementById('download-speed');
  const progressBar = document.getElementById('download-progress');
  const progressText = document.getElementById('progress-text');

  // Reset and show progress bar
  progressBar.value = 0;
  progressBar.style.display = 'block';
  progressText.textContent = '0%';

  statusEl.textContent = 'Downloading...';

  // Generate a unique URL to bypass cache
  const uniqueUrl = `${FILE_URL}?nocache=${Date.now()}`;

  // Create an AbortController to cancel the fetch if needed
  currentDownloadController = new AbortController();
  const signal = currentDownloadController.signal;

  // Start time
  const startTime = performance.now();

  try {
    // Start the download via fetch with abort support
    const response = await fetch(uniqueUrl, { cache: 'no-cache', signal });
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
    if (error.name === 'AbortError') {
      console.log('Download aborted');
      statusEl.textContent = 'Download aborted';
    } else {
      console.error('Download error:', error);
      statusEl.textContent = 'Error during download';
    }
    progressBar.style.display = 'none';
    progressText.textContent = '';
  } finally {
    isTestRunning = false; // Allow the next test to start
    currentDownloadController = null; // Reset the controller
  }
}

// Save test results to localStorage
function saveTestResult(result) {
  const stored = localStorage.getItem(STORAGE_KEY);
  const data = stored ? JSON.parse(stored) : [];
  
  // Calculate total downloaded data usage
  const totalDownloadedMB = data.reduce((sum, curr) => sum + curr.dataDownloadedMB, 0) + result.dataDownloadedMB;
  result.totalDownloadedMB = totalDownloadedMB; // Add total downloaded data usage key

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

  // Prepare data for the chart: total downloaded data usage (x-axis) and speeds (y-axis)
  const labels = data.map(item => item.totalDownloadedMB.toFixed(2)); // Total downloaded data in MB
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
          x: { 
            title: { display: true, text: 'Total Data Usage (MB)' } 
          },
          y: { 
            title: { display: true, text: 'Speed (Mbps)' } 
          }
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
