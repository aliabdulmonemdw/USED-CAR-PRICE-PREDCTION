document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const form = document.getElementById('prediction-form');
    const resetButton = document.getElementById('reset-button');
    const yearSlider = document.getElementById('Year');
    const yearValue = document.getElementById('year-value');
    const resultsContainer = document.getElementById('results-container');
    const predictedPrice = document.getElementById('predicted-price');
    const loadingIndicator = document.getElementById('loading-indicator');
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');
    const samplesContainer = document.getElementById('samples-container');
    const modelMetricsContainer = document.getElementById('model-metrics');
    
    // Check if makeTypeMap is defined (should be passed from Flask)
    const makeTypeMappingExists = typeof makeTypeMap !== 'undefined' && Object.keys(makeTypeMap).length > 0;
    
    // Initialize form elements
    initFormElements();
    
    // Update type options when make changes
    document.getElementById('Make').addEventListener('change', function() {
        const makeSelection = this.value;
        const typeSelect = document.getElementById('Type');
        
        // Clear current options
        typeSelect.innerHTML = '<option value="" disabled selected>Select Type</option>';
        
        // Show loading indicator in the Type dropdown
        typeSelect.innerHTML += '<option value="" disabled>Loading...</option>';
        
        if (makeTypeMappingExists && makeTypeMap[makeSelection]) {
            // Use the pre-defined mapping from Flask
            populateTypeOptions(makeTypeMap[makeSelection]);
        } else {
            // Fetch types from server
            fetch(`/get_types/${makeSelection}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.types && data.types.length > 0) {
                        populateTypeOptions(data.types);
                    } else {
                        // If no specific types found, show error
                        typeSelect.innerHTML = '<option value="" disabled selected>No types found for this make</option>';
                    }
                })
                .catch(error => {
                    console.error('Error fetching car types:', error);
                    typeSelect.innerHTML = '<option value="" disabled selected>Error loading types</option>';
                });
        }
    });
    
    // Function to populate the Type dropdown
    function populateTypeOptions(types) {
        const typeSelect = document.getElementById('Type');
        
        // Clear current options including loading message
        typeSelect.innerHTML = '<option value="" disabled selected>Select Type</option>';
        
        // Sort types alphabetically
        types.sort();
        
        // Add options
        types.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            typeSelect.appendChild(option);
        });
    }
    
    // Update year value display when slider moves
    yearSlider.addEventListener('input', function() {
        yearValue.textContent = this.value;
    });
    
    // Handle form submission
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Validate form
        if (!validateForm()) {
            return;
        }
        
        // Hide previous results or errors
        resultsContainer.style.display = 'none';
        errorContainer.style.display = 'none';
        
        // Show loading indicator
        loadingIndicator.style.display = 'block';
        
        // Get form data
        const formData = new FormData(form);
        
        // Send prediction request
        fetch('/predict', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            // Hide loading indicator
            loadingIndicator.style.display = 'none';
            
            if (data.error) {
                // Show error message
                errorMessage.textContent = data.error;
                errorContainer.style.display = 'block';
            } else {
                // Update results
                predictedPrice.textContent = data.predicted_price;
                
                // Show results
                resultsContainer.style.display = 'block';
                
                // Scroll to results
                resultsContainer.scrollIntoView({ behavior: 'smooth' });
            }
        })
        .catch(error => {
            // Hide loading indicator
            loadingIndicator.style.display = 'none';
            
            // Show error message
            errorMessage.textContent = 'An error occurred during prediction. Please try again.';
            errorContainer.style.display = 'block';
            console.error('Prediction error:', error);
        });
    });
    
    // Handle form reset
    resetButton.addEventListener('click', function() {
        form.reset();
        resultsContainer.style.display = 'none';
        errorContainer.style.display = 'none';
        
        // Reset year display
        yearValue.textContent = yearSlider.value;
        
        // Reset Type dropdown to initial state
        const typeSelect = document.getElementById('Type');
        typeSelect.innerHTML = '<option value="" disabled selected>Select Type</option>';
        
        // Reset form styling
        const formElements = form.querySelectorAll('select, input');
        formElements.forEach(element => {
            element.classList.remove('error');
            
            // Remove any error tooltips
            const parent = element.closest('.form-group');
            const tooltip = parent.querySelector('.error-tooltip');
            if (tooltip) {
                tooltip.remove();
            }
        });
    });
    
    // Load model information
    function loadModelInfo() {
        fetch('/model_info')
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                modelMetricsContainer.innerHTML = `<p>Error loading model information: ${data.error}</p>`;
                return;
            }
            
            // Calculate percentage R² for display
            const r2Percent = (data.r2_score * 100).toFixed(1);
            
            let html = `
                <div class="model-name">
                    <strong>${data.model_name}</strong> ${data.is_log_model ? '(Log-Transformed)' : ''}
                </div>
                <div class="metric-cards">
                    <div class="metric-card">
                        <div class="metric-name">R² Score</div>
                        <div class="metric-value">${r2Percent}%</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-name">RMSE</div>
                        <div class="metric-value">${data.rmse.toLocaleString()}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-name">MAE</div>
                        <div class="metric-value">${data.mae.toLocaleString()}</div>
                    </div>
                </div>
            `;
            
            modelMetricsContainer.innerHTML = html;
        })
        .catch(error => {
            modelMetricsContainer.innerHTML = `<p>Error loading model information</p>`;
            console.error('Model info error:', error);
        });
    }
    
    // Load sample data
    function loadSampleData() {
        fetch('/test_data')
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                samplesContainer.innerHTML = `<p>No sample data available</p>`;
                return;
            }
            
            if (data.make_type_map && Object.keys(data.make_type_map).length > 0) {
                // Update our local mapping if server provided one
                Object.assign(window.makeTypeMap || {}, data.make_type_map);
            }
            
            if (data.samples && data.samples.length > 0) {
                let samplesHTML = '';
                
                // Show up to 6 samples to prevent overcrowding
                const samplesToShow = data.samples.slice(0, 6);
                
                samplesToShow.forEach(sample => {
                    samplesHTML += `
                        <div class="sample-card" data-sample='${JSON.stringify(sample)}'>
                            <h4>${sample.Make} ${sample.Type} (${sample.Year})</h4>
                            <div class="sample-details">
                                <p><span>Engine:</span> <span>${sample.Engine_Size}L ${sample.Fuel_Type}</span></p>
                                <p><span>Transmission:</span> <span>${sample.Gear_Type}</span></p>
                                <p><span>Mileage:</span> <span>${sample.Mileage.toLocaleString()} km</span></p>
                                <p><span>Color:</span> <span>${sample.Color}</span></p>
                            </div>
                            <div class="sample-price">
                                ${sample.Price.toLocaleString()} SAR
                            </div>
                        </div>
                    `;
                });
                
                samplesContainer.innerHTML = samplesHTML;
                
                // Add click event to sample cards
                document.querySelectorAll('.sample-card').forEach(card => {
                    card.addEventListener('click', function() {
                        const sampleData = JSON.parse(this.getAttribute('data-sample'));
                        fillFormWithSample(sampleData);
                    });
                });
            } else {
                samplesContainer.innerHTML = `<p>No sample data available</p>`;
            }
        })
        .catch(error => {
            samplesContainer.innerHTML = `<p>Error loading samples</p>`;
            console.error('Sample data error:', error);
        });
    }
    
    // Fill form with sample data
    function fillFormWithSample(sample) {
        // First, set the make
        const makeField = document.getElementById('Make');
        if (makeField && sample.Make) {
            makeField.value = sample.Make;
            
            // Trigger the change event to update the type options
            const event = new Event('change');
            makeField.dispatchEvent(event);
            
            // Then, set each form field to the sample value after a short delay
            // to allow the type options to be populated
            setTimeout(() => {
                for (const [key, value] of Object.entries(sample)) {
                    const field = document.getElementById(key);
                    if (field && !key.includes('Predicted') && !key.includes('Error')) {
                        field.value = value;
                        
                        // If it's the year slider, update the display
                        if (key === 'Year') {
                            yearValue.textContent = value;
                        }
                    }
                }
                
                // Add highlight animation to the form
                form.classList.add('highlight-form');
                setTimeout(() => {
                    form.classList.remove('highlight-form');
                }, 1000);
            }, 300); // Increased timeout to ensure types are loaded
        }
        
        // Scroll to top of form
        form.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Form validation
    function validateForm() {
        let isValid = true;
        const formElements = form.querySelectorAll('select, input');
        
        formElements.forEach(element => {
            // Remove previous error styling and tooltips
            element.classList.remove('error');
            const parent = element.closest('.form-group');
            const existingTooltip = parent.querySelector('.error-tooltip');
            if (existingTooltip) {
                existingTooltip.remove();
            }
            
            // Check required fields
            if (element.hasAttribute('required') && !element.value) {
                element.classList.add('error');
                addErrorTooltip(element, 'This field is required');
                isValid = false;
            }
            
            // Validate numeric inputs
            if (element.type === 'number' && element.value) {
                const numValue = parseFloat(element.value);
                const min = element.hasAttribute('min') ? parseFloat(element.getAttribute('min')) : null;
                const max = element.hasAttribute('max') ? parseFloat(element.getAttribute('max')) : null;
                
                if ((min !== null && numValue < min) || (max !== null && numValue > max)) {
                    element.classList.add('error');
                    const message = `Value must be between ${min} and ${max}`;
                    addErrorTooltip(element, message);
                    isValid = false;
                }
            }
        });
        
        if (!isValid) {
            // Scroll to the first error
            const firstError = form.querySelector('.error');
            if (firstError) {
                firstError.focus();
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            
            errorMessage.textContent = 'Please correct the highlighted fields.';
            errorContainer.style.display = 'block';
        }
        
        return isValid;
    }
    
    // Add error tooltip to form element
    function addErrorTooltip(element, message) {
        const parent = element.closest('.form-group');
        const tooltip = document.createElement('div');
        tooltip.className = 'error-tooltip';
        tooltip.textContent = message;
        parent.appendChild(tooltip);
    }
    
    // Initialize form elements and interactive features
    function initFormElements() {
        // Set max year to 2025
        yearSlider.max = 2025;
        
        // Initial year value display
        if (yearValue) {
            yearValue.textContent = yearSlider.value;
        }
        
        // Create global makeTypeMap if not already provided
        if (typeof window.makeTypeMap === 'undefined') {
            window.makeTypeMap = {};
        }
    }
    
    // Initialize page data
    loadModelInfo();
    loadSampleData();
});