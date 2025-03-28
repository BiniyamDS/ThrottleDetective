document.getElementById('start-test').addEventListener('click', function() {
    const resultsDiv = document.getElementById('test-results');
    const stopButton = document.getElementById('stop-test');
    resultsDiv.style.display = 'block';
    stopButton.style.display = 'inline-block';
});

document.getElementById('stop-test').addEventListener('click', function() {
    const resultsDiv = document.getElementById('test-results');
    resultsDiv.style.display = 'none';
    this.style.display = 'none'; // Correctly hides the stop button itself
});