// --- DOM Element Selectors ---
const startButton = document.getElementById('start-test');
const stopButton = document.getElementById('stop-test');
const testResultsDiv = document.getElementById('test-results');
const downloadStatusEl = document.getElementById('download-status');
const downloadSpeedEl = document.getElementById('download-speed');
const progressBar = document.getElementById('download-progress');
const progressTextEl = document.getElementById('progress-text'); // Updated reference
const totalDataEl = document.getElementById('total-data');
const averageSpeedEl = document.getElementById('average-speed');
const elapsedTimeEl = document.getElementById('elapsed-time');
const chartContainer = document.querySelector('.chart-container'); // Select the container div
const speedChartCanvas = document.getElementById('speedChart'); // Canvas itself

// --- State Variables ---
let elapsedTimeInterval; // Interval for updating the elapsed time
let testInterval; // Interval for running tests repeatedly
let isTestRunning = false; // Flag to prevent overlapping tests
let currentDownloadController; // Controller to abort the current download
let chart; // Global chart instance

// --- Constants ---
const FILE_URL = 'https://cachefly.cachefly.net/10mb.test'; // Using HTTPS
const FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const STORAGE_KEY = 'throttleTestData';
const TEST_INTERVAL_MS = 5000; // Run every 5 seconds

// --- UI Update Functions ---

function updateUIForStart() {
    startButton.style.display = 'none';
    stopButton.style.display = 'inline-block';
    testResultsDiv.style.display = 'block';
    chartContainer.style.display = 'block'; // Show chart container
    progressBar.style.display = 'block'; // Show progress bar immediately
    progressBar.value = 0;
    progressTextEl.textContent = '0%';
    elapsedTimeEl.textContent = '00:00';
    downloadStatusEl.textContent = 'Initiating...';
    downloadSpeedEl.textContent = '--'; // Reset speed display
}

function updateUIForStop(status = 'Idle') {
    startButton.style.display = 'inline-block';
    stopButton.style.display = 'none';
    downloadStatusEl.textContent = status;
    progressBar.style.display = 'none';
    progressTextEl.textContent = '';
    // Keep results and chart visible
}

function updateUIForProgress(percentage) {
    progressBar.value = percentage;
    progressTextEl.textContent = `${percentage.toFixed(1)}%`; // Show one decimal place
}

// --- Test Logic ---

async function runDownloadTest() {
    if (isTestRunning) return; // Prevent overlapping tests
    isTestRunning = true;

    downloadStatusEl.textContent = 'Downloading...';
    progressBar.style.display = 'block'; // Ensure progress bar is visible
    updateUIForProgress(0); // Reset progress display

    // Generate a unique URL to bypass cache
    const uniqueUrl = `${FILE_URL}?nocache=${Date.now()}`;

    // Create an AbortController to cancel the fetch if needed
    currentDownloadController = new AbortController();
    const signal = currentDownloadController.signal;

    const startTime = performance.now();
    let receivedLength = 0;

    try {
        // Start the download via fetch with abort support
        const response = await fetch(uniqueUrl, { cache: 'no-cache', signal });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        if (!response.body) {
             throw new Error('Response body is missing');
        }

        // Use the ReadableStream interface to monitor progress
        const reader = response.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            receivedLength += value.length;
            // Update progress indicator (calculate percentage)
            let percent = Math.min(100, (receivedLength / FILE_SIZE_BYTES) * 100); // Cap at 100
            updateUIForProgress(percent);
        }

        // End time after the stream has finished
        const endTime = performance.now();
        const durationSec = (endTime - startTime) / 1000;

        // Ensure duration is not zero and received length matches expected size
        if (durationSec > 0 && receivedLength === FILE_SIZE_BYTES) {
             // Compute speed in Mbps: (Bytes * 8 bits) / (seconds * 1,000,000)
            const speedMbps = ((receivedLength) / (durationSec * 1e6)).toFixed(2);

            // Update UI
            downloadSpeedEl.textContent = `${speedMbps} Mbps`;
            downloadStatusEl.textContent = 'Completed';

            // Save result and update aggregates/chart
            saveTestResult({
                timestamp: Date.now(),
                speedMbps: Number(speedMbps),
                dataDownloadedMB: FILE_SIZE_BYTES / (1024 * 1024)
            });
            updateTestResultsUI();
            updateChart();

        } else if (receivedLength !== FILE_SIZE_BYTES) {
            throw new Error(`Incomplete download: received ${receivedLength} bytes, expected ${FILE_SIZE_BYTES}`);
        } else {
             throw new Error('Download duration too short for accurate measurement.');
        }

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Download aborted');
            downloadStatusEl.textContent = 'Download aborted';
        } else {
            console.error('Download error:', error);
            downloadStatusEl.textContent = 'Error'; // Keep it concise
            downloadSpeedEl.textContent = '--';
        }
    } finally {
        progressBar.style.display = 'none'; // Hide progress bar on completion/error/abort
        progressTextEl.textContent = '';
        isTestRunning = false; // Allow the next test to start
        currentDownloadController = null; // Reset the controller
    }
}

// --- Data Handling ---

function saveTestResult(result) {
    const stored = localStorage.getItem(STORAGE_KEY);
    let data = stored ? JSON.parse(stored) : [];

    // Ensure data is an array
    if (!Array.isArray(data)) {
        data = [];
    }

    // Calculate total downloaded data usage up to this point
    const previousTotalMB = data.length > 0 ? data[data.length - 1].totalDownloadedMB || 0 : 0;
    result.totalDownloadedMB = previousTotalMB + result.dataDownloadedMB;

    data.push(result);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getStoredData() {
    const stored = localStorage.getItem(STORAGE_KEY);
    let data = stored ? JSON.parse(stored) : [];
     // Ensure data is an array, clear storage if corrupted
    if (!Array.isArray(data)) {
        console.warn("Stored data is corrupted, clearing storage.");
        localStorage.removeItem(STORAGE_KEY);
        data = [];
    }
    return data;
}

function updateTestResultsUI() {
    const data = getStoredData();
    if (data.length === 0) {
        totalDataEl.textContent = `0 MB`;
        averageSpeedEl.textContent = `-- Mbps`;
        return;
    }

    // Use the total from the last entry
    const totalData = data[data.length - 1].totalDownloadedMB || 0;
    // Average speed
    const avgSpeed = (data.reduce((sum, curr) => sum + curr.speedMbps, 0) / data.length).toFixed(2);

    totalDataEl.textContent = `${totalData.toFixed(2)} MB`;
    averageSpeedEl.textContent = `${avgSpeed} Mbps`;
}

// --- Charting ---

function updateChart() {
    const data = getStoredData();
    if (chartContainer.style.display === 'none' && data.length > 0) {
        chartContainer.style.display = 'block'; // Show container if we have data on load
    }

    if (data.length === 0) {
        // Optionally hide chart or show message if no data
        if (chart) {
            chart.destroy(); // Destroy existing chart if data is cleared
            chart = null;
        }
        // chartContainer.style.display = 'none'; // Or hide it
        return;
    }


    // Prepare data for the chart: total downloaded data usage (x-axis) and speeds (y-axis)
    const labels = data.map(item => (item.totalDownloadedMB || 0).toFixed(2)); // Use total MB
    const speeds = data.map(item => item.speedMbps);

    const ctx = speedChartCanvas.getContext('2d');

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
                    borderColor: 'rgb(0, 122, 255)', // Match primary color variable
                    backgroundColor: 'rgba(0, 122, 255, 0.1)', // Optional fill
                    fill: true, // Enable fill
                    tension: 0.1, // Slight curve
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true, // Adjust as needed, true might be better initially
                scales: {
                    x: {
                        title: { display: true, text: 'Total Data Usage (MB)', color: '#636366' }, // Secondary text color
                        ticks: { color: '#636366' }
                    },
                    y: {
                        title: { display: true, text: 'Speed (Mbps)', color: '#636366' },
                        ticks: { color: '#636366' },
                        beginAtZero: true // Start y-axis at 0
                    }
                },
                plugins: {
                    legend: {
                         labels: { color: '#1c1c1e' } // Main text color
                    }
                }
            }
        });
    }
}

// --- Event Listeners ---

startButton.addEventListener('click', () => {
    updateUIForStart();
    runDownloadTest(); // Run the first test immediately

    // Start the elapsed time timer
    let elapsedSeconds = 0;
    elapsedTimeInterval = setInterval(() => {
        elapsedSeconds++;
        const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
        const seconds = (elapsedSeconds % 60).toString().padStart(2, '0');
        elapsedTimeEl.textContent = `${minutes}:${seconds}`;
    }, 1000);

    // Start running tests in a loop
    testInterval = setInterval(() => {
        if (!isTestRunning) {
            runDownloadTest();
        }
    }, TEST_INTERVAL_MS);
});

stopButton.addEventListener('click', () => {
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
        currentDownloadController.abort(); // AbortError will be caught in runDownloadTest
    } else {
        // If no download was active, just update UI to Idle
         updateUIForStop('Stopped');
    }
     // If a download was aborted, the 'finally' block in runDownloadTest
     // will set isTestRunning = false. If no download was active, ensure it's false.
    isTestRunning = false;
    // Update UI immediately for responsiveness, even if abort takes a moment
    updateUIForStop('Stopped');
});

// --- Initial Page Load ---
window.addEventListener('load', () => {
    // Set initial UI state
    stopButton.style.display = 'none';
    testResultsDiv.style.display = 'none';
    chartContainer.style.display = 'none';
    progressBar.style.display = 'none';
    progressTextEl.textContent = '';

    // Load existing data and update UI/Chart
    updateTestResultsUI();
    updateChart(); // This will also show the chart container if data exists
});