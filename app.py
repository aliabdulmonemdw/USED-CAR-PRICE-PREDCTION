import pickle
import numpy as np
from flask import Flask, render_template, request, jsonify
import os
import pandas as pd

app = Flask(__name__)

# Load model and related files
model_dir = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(model_dir, '/Users/alidiwani/Documents/CCSIT PROJECTS 2025 /UC/car_price_prediction_webapp V2/Model Infos/car_price_prediction_model.pkl')
info_path = os.path.join(model_dir, '/Users/alidiwani/Documents/CCSIT PROJECTS 2025 /UC/car_price_prediction_webapp V2/Model Infos/model_info.pkl')
categorical_values_path = os.path.join(model_dir, '/Users/alidiwani/Documents/CCSIT PROJECTS 2025 /UC/car_price_prediction_webapp V2/Model Infos/categorical_values.pkl')
test_data_path = os.path.join(model_dir, '/Users/alidiwani/Documents/CCSIT PROJECTS 2025 /UC/car_price_prediction_webapp V2/Model Infos/test_dataset_readable.csv')

# Load the original CSV dataset for Make-Type relationships
dataset_path = os.path.join(model_dir, 'Model Infos/UsedCarsSA_Clean_EN.csv')

# Load the model
with open(model_path, 'rb') as f:
    model = pickle.load(f)

# Load model info (contains label encoders and feature information)
with open(info_path, 'rb') as f:
    model_info = pickle.load(f)

# Load categorical values for dropdown options
with open(categorical_values_path, 'rb') as f:
    categorical_values = pickle.load(f)

# Get model configuration
label_encoders = model_info['label_encoders']
categorical_features = model_info['categorical_features']
numerical_features = model_info.get('numerical_features', [])
feature_list = model_info['features']
is_log_model = model_info.get('is_log_model', False)

# Load test dataset for examples
if os.path.exists(test_data_path):
    test_df = pd.read_csv(test_data_path)
    # Get min/max years from test data
    min_year = int(test_df['Year'].min()) if 'Year' in test_df.columns else 2000
    max_year = int(test_df['Year'].max()) if 'Year' in test_df.columns else 2025
else:
    test_df = None
    min_year = 1990
    max_year = 2025

# Load full dataset for accurate Make-Type mapping
original_df = None
make_type_map = {}
if os.path.exists(dataset_path):
    try:
        original_df = pd.read_csv(dataset_path)
        # Create mapping of makes to types
        for make in original_df['Make'].unique():
            types = original_df[original_df['Make'] == make]['Type'].unique().tolist()
            make_type_map[make] = types
            
        # Update categorical values with complete make/type data
        if 'Make' in original_df.columns:
            categorical_values['Make'] = sorted(original_df['Make'].unique().tolist())
        if 'Type' in original_df.columns:
            categorical_values['Type'] = sorted(original_df['Type'].unique().tolist())
    except Exception as e:
        print(f"Error loading original dataset: {e}")

# Set current year for feature engineering
current_year = 2025

# Functions for feature engineering (copied from model training)
def categorize_make(make):
    luxury_brands = ['Mercedes-Benz', 'BMW', 'Audi', 'Lexus', 'Porsche', 'Land Rover', 'Jaguar', 
                     'Bentley', 'Rolls-Royce', 'Cadillac', 'Maserati', 'Lamborghini', 'Ferrari']
    budget_brands = ['Kia', 'Hyundai', 'Geely', 'Chery', 'Suzuki', 'Daihatsu', 'Faw', 'Byd', 'Great Wall']
    
    if make in luxury_brands:
        return 'Luxury'
    elif make in budget_brands:
        return 'Budget'
    else:
        return 'Standard'

def categorize_engine(size):
    try:
        size = float(size)
        if size < 1.5:
            return 'Small'
        elif size < 2.5:
            return 'Medium'
        elif size < 4.0:
            return 'Large'
        else:
            return 'Very Large'
    except:
        return 'Medium'  # Default

def categorize_mileage(miles):
    try:
        miles = float(miles)
        if miles < 50000:
            return 'Low'
        elif miles < 100000:
            return 'Medium'
        elif miles < 150000:
            return 'High'
        else:
            return 'Very High'
    except:
        return 'Medium'  # Default

@app.route('/')
def home():
    # Pass categorical values and make-type mapping to template
    return render_template('index.html', 
                          categorical_values=categorical_values,
                          min_year=min_year,
                          max_year=2025,  # Set max year to 2025
                          current_year=2023,
                          make_type_map=make_type_map)

@app.route('/predict', methods=['POST'])
def predict():
    try:
        # Get form data
        input_data = {}
        
        # First, collect all original inputs from the form
        for feature in request.form:
            form_value = request.form.get(feature, '')
            if form_value:
                if feature in categorical_features:
                    input_data[feature] = form_value
                else:
                    # Convert numeric features
                    input_data[feature] = float(form_value)
            else:
                return jsonify({"error": f"Missing value for {feature}"})
        
        # Perform feature engineering just like in the model training
        if 'Year' in input_data:
            input_data['Car_Age'] = current_year - input_data['Year']
            
        if 'Make' in input_data:
            input_data['Make_Category'] = categorize_make(input_data['Make'])
            
        if 'Engine_Size' in input_data:
            input_data['Engine_Category'] = categorize_engine(input_data['Engine_Size'])
            
        if 'Mileage' in input_data:
            input_data['Mileage_Category'] = categorize_mileage(input_data['Mileage'])
        
        # Prepare data for prediction by encoding categorical features
        for feature in categorical_features:
            if feature in input_data:
                try:
                    input_data[feature] = label_encoders[feature].transform([input_data[feature]])[0]
                except:
                    # Handle unknown categories
                    return jsonify({"error": f"Unknown value for {feature}: {input_data[feature]}"})
        
        # Create input array in correct order for the model
        input_array = [input_data.get(feature, 0) for feature in feature_list]
        
        # Make prediction
        predicted_price = model.predict([input_array])[0]
        
        # If using a log-transformed model, convert back to original scale
        if is_log_model:
            predicted_price = np.expm1(predicted_price)
        
        # Round to nearest whole number
        predicted_price = round(predicted_price)
        
        # Format with commas for thousands
        formatted_price = f"{predicted_price:,}"
        
        return jsonify({
            "success": True,
            "predicted_price": formatted_price,
            "raw_price": predicted_price
        })
    
    except Exception as e:
        return jsonify({"error": str(e)})

# Test data endpoint for displaying sample predictions
@app.route('/test_data')
def test_data():
    try:
        # If test dataset is unavailable, return empty
        if test_df is None:
            return jsonify({"error": "Test dataset not available"})
            
        # Get samples from test dataset with prediction results
        if 'Predicted_Price' in test_df.columns:
            # Use test data with predictions from model training
            samples = test_df.sort_values(by='Error_Percentage', key=abs).head(10).to_dict('records')
        else:
            # Just use the first 10 samples
            samples = test_df.head(10).to_dict('records')
        
        # Format numeric values for display
        for sample in samples:
            for key, value in sample.items():
                if isinstance(value, (int, float)) and not isinstance(value, bool):
                    if key in ['Price', 'Predicted_Price']:
                        sample[key] = int(value)
                    elif key == 'Engine_Size':
                        sample[key] = float(value)
                    elif key == 'Mileage':
                        sample[key] = int(value)
        
        return jsonify({
            "success": True,
            "samples": samples,
            "make_type_map": make_type_map
        })
        
    except Exception as e:
        return jsonify({"error": str(e)})

# Model info endpoint
@app.route('/model_info')
def get_model_info():
    try:
        model_metrics = model_info.get('metrics', {})
        
        return jsonify({
            "success": True,
            "model_name": model_info.get('model_name', 'Car Price Prediction Model'),
            "r2_score": model_metrics.get('r2', 0),
            "rmse": model_metrics.get('rmse', 0),
            "mae": model_metrics.get('mae', 0),
            "is_log_model": is_log_model
        })
    except Exception as e:
        return jsonify({"error": str(e)})

# Get car types for a specific make
@app.route('/get_types/<make>')
def get_types(make):
    try:
        if make in make_type_map:
            types = make_type_map[make]
            return jsonify({
                "success": True,
                "types": types
            })
        elif original_df is not None:
            # Fallback to filtering the dataframe directly
            types = original_df[original_df['Make'] == make]['Type'].unique().tolist()
            return jsonify({
                "success": True,
                "types": types
            })
        else:
            # Return all types if we can't filter
            return jsonify({
                "success": True,
                "types": categorical_values.get('Type', [])
            })
    except Exception as e:
        return jsonify({"error": str(e)})

if __name__ == '__main__':
    app.run(debug=True)