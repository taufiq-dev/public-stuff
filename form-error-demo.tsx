import React, { useState } from 'react';

type FieldError = {
  message: string;
  fieldPath: string;
};

type FormErrors = {
  [widgetId: string]: {
    [fieldName: string]: string;
  };
};

type MasterFormData = {
  widgets: Record<string, any>;
};

// Mock API function that simulates validation errors
const mockApiSubmit = async (data: MasterFormData): Promise<{ success: boolean; fieldErrors?: FieldError[]; message?: string }> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const errors: FieldError[] = [];
  
  // Check user profile widget
  const userProfile = data.widgets.userProfile;
  if (userProfile) {
    if (!userProfile.email || !userProfile.email.includes('@')) {
      errors.push({
        fieldPath: 'widgets.userProfile.email',
        message: 'Please enter a valid email address'
      });
    }
    if (!userProfile.firstName || userProfile.firstName.length < 2) {
      errors.push({
        fieldPath: 'widgets.userProfile.firstName',
        message: 'First name must be at least 2 characters'
      });
    }
    if (userProfile.age && userProfile.age < 18) {
      errors.push({
        fieldPath: 'widgets.userProfile.age',
        message: 'Must be 18 or older'
      });
    }
  }
  
  // Check preferences widget
  const preferences = data.widgets.preferences;
  if (preferences) {
    if (!preferences.newsletter) {
      errors.push({
        fieldPath: 'widgets.preferences.newsletter',
        message: 'Newsletter subscription is required'
      });
    }
    if (preferences.theme === 'custom' && !preferences.customColor) {
      errors.push({
        fieldPath: 'widgets.preferences.customColor',
        message: 'Custom color is required when using custom theme'
      });
    }
  }
  
  // Check address widget
  const address = data.widgets.address;
  if (address) {
    if (!address.street || address.street.length < 5) {
      errors.push({
        fieldPath: 'widgets.address.street',
        message: 'Street address must be at least 5 characters'
      });
    }
    if (!address.zipCode || !/^\d{5}$/.test(address.zipCode)) {
      errors.push({
        fieldPath: 'widgets.address.zipCode',
        message: 'Zip code must be exactly 5 digits'
      });
    }
  }
  
  if (errors.length > 0) {
    return {
      success: false,
      fieldErrors: errors
    };
  }
  
  return {
    success: true,
    message: 'Form submitted successfully!'
  };
};

// Widget Form Component
type WidgetFormProps = {
  widgetId: string;
  title: string;
  onDataChange: (data: any) => void;
  errors: Record<string, string>;
  children: React.ReactNode;
};

const WidgetForm: React.FC<WidgetFormProps> = ({ widgetId, title, onDataChange, errors, children }) => {
  return (
    <div className="widget-form">
      <h3 className="widget-title">{title}</h3>
      <div className="widget-content">
        {children}
      </div>
    </div>
  );
};

// Field Component with Error Display
type FieldProps = {
  label: string;
  error?: string;
  children: React.ReactNode;
};

const Field: React.FC<FieldProps> = ({ label, error, children }) => {
  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      {children}
      {error && <div className="field-error">{error}</div>}
    </div>
  );
};

// User Profile Widget
type UserProfileProps = {
  onDataChange: (data: any) => void;
  errors: Record<string, string>;
};

const UserProfileWidget: React.FC<UserProfileProps> = ({ onDataChange, errors }) => {
  const [data, setData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    age: ''
  });

  const handleChange = (field: string, value: string) => {
    const newData = { ...data, [field]: value };
    setData(newData);
    onDataChange(newData);
  };

  return (
    <WidgetForm widgetId="userProfile" title="User Profile" onDataChange={onDataChange} errors={errors}>
      <Field label="Email" error={errors.email}>
        <input
          type="email"
          value={data.email}
          onChange={(e) => handleChange('email', e.target.value)}
          className={`input ${errors.email ? 'input-error' : ''}`}
          placeholder="user@example.com"
        />
      </Field>
      
      <Field label="First Name" error={errors.firstName}>
        <input
          type="text"
          value={data.firstName}
          onChange={(e) => handleChange('firstName', e.target.value)}
          className={`input ${errors.firstName ? 'input-error' : ''}`}
          placeholder="John"
        />
      </Field>
      
      <Field label="Last Name" error={errors.lastName}>
        <input
          type="text"
          value={data.lastName}
          onChange={(e) => handleChange('lastName', e.target.value)}
          className={`input ${errors.lastName ? 'input-error' : ''}`}
          placeholder="Doe"
        />
      </Field>
      
      <Field label="Age" error={errors.age}>
        <input
          type="number"
          value={data.age}
          onChange={(e) => handleChange('age', e.target.value)}
          className={`input ${errors.age ? 'input-error' : ''}`}
          placeholder="25"
        />
      </Field>
    </WidgetForm>
  );
};

// Preferences Widget
type PreferencesProps = {
  onDataChange: (data: any) => void;
  errors: Record<string, string>;
};

const PreferencesWidget: React.FC<PreferencesProps> = ({ onDataChange, errors }) => {
  const [data, setData] = useState({
    newsletter: false,
    theme: 'light',
    customColor: ''
  });

  const handleChange = (field: string, value: any) => {
    const newData = { ...data, [field]: value };
    setData(newData);
    onDataChange(newData);
  };

  return (
    <WidgetForm widgetId="preferences" title="Preferences" onDataChange={onDataChange} errors={errors}>
      <Field label="Newsletter Subscription" error={errors.newsletter}>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={data.newsletter}
            onChange={(e) => handleChange('newsletter', e.target.checked)}
          />
          Subscribe to newsletter
        </label>
      </Field>
      
      <Field label="Theme" error={errors.theme}>
        <select
          value={data.theme}
          onChange={(e) => handleChange('theme', e.target.value)}
          className={`input ${errors.theme ? 'input-error' : ''}`}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="custom">Custom</option>
        </select>
      </Field>
      
      {data.theme === 'custom' && (
        <Field label="Custom Color" error={errors.customColor}>
          <input
            type="color"
            value={data.customColor}
            onChange={(e) => handleChange('customColor', e.target.value)}
            className={`input ${errors.customColor ? 'input-error' : ''}`}
          />
        </Field>
      )}
    </WidgetForm>
  );
};

// Address Widget
type AddressProps = {
  onDataChange: (data: any) => void;
  errors: Record<string, string>;
};

const AddressWidget: React.FC<AddressProps> = ({ onDataChange, errors }) => {
  const [data, setData] = useState({
    street: '',
    city: '',
    state: '',
    zipCode: ''
  });

  const handleChange = (field: string, value: string) => {
    const newData = { ...data, [field]: value };
    setData(newData);
    onDataChange(newData);
  };

  return (
    <WidgetForm widgetId="address" title="Address" onDataChange={onDataChange} errors={errors}>
      <Field label="Street Address" error={errors.street}>
        <input
          type="text"
          value={data.street}
          onChange={(e) => handleChange('street', e.target.value)}
          className={`input ${errors.street ? 'input-error' : ''}`}
          placeholder="123 Main Street"
        />
      </Field>
      
      <div className="field-row">
        <Field label="City" error={errors.city}>
          <input
            type="text"
            value={data.city}
            onChange={(e) => handleChange('city', e.target.value)}
            className={`input ${errors.city ? 'input-error' : ''}`}
            placeholder="New York"
          />
        </Field>
        
        <Field label="State" error={errors.state}>
          <input
            type="text"
            value={data.state}
            onChange={(e) => handleChange('state', e.target.value)}
            className={`input ${errors.state ? 'input-error' : ''}`}
            placeholder="NY"
          />
        </Field>
        
        <Field label="Zip Code" error={errors.zipCode}>
          <input
            type="text"
            value={data.zipCode}
            onChange={(e) => handleChange('zipCode', e.target.value)}
            className={`input ${errors.zipCode ? 'input-error' : ''}`}
            placeholder="12345"
          />
        </Field>
      </div>
    </WidgetForm>
  );
};

// Master Form Component
const MasterForm: React.FC = () => {
  const [formData, setFormData] = useState<MasterFormData>({ widgets: {} });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string>('');

  const handleWidgetDataChange = (widgetId: string, data: any) => {
    setFormData(prev => ({
      ...prev,
      widgets: {
        ...prev.widgets,
        [widgetId]: data
      }
    }));
    
    // Clear errors for this widget when data changes
    if (errors[widgetId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[widgetId];
        return newErrors;
      });
    }
    
    // Clear submit message
    if (submitMessage) {
      setSubmitMessage('');
    }
  };

  const parseApiErrors = (apiErrors: FieldError[]): FormErrors => {
    const parsedErrors: FormErrors = {};
    
    apiErrors.forEach(error => {
      const pathParts = error.fieldPath.split('.');
      
      if (pathParts[0] === 'widgets' && pathParts.length >= 3) {
        const widgetId = pathParts[1];
        const fieldName = pathParts.slice(2).join('.');
        
        if (!parsedErrors[widgetId]) {
          parsedErrors[widgetId] = {};
        }
        parsedErrors[widgetId][fieldName] = error.message;
      }
    });
    
    return parsedErrors;
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrors({});
    setSubmitMessage('');
    
    try {
      const response = await mockApiSubmit(formData);
      
      if (!response.success && response.fieldErrors) {
        const parsedErrors = parseApiErrors(response.fieldErrors);
        setErrors(parsedErrors);
        setSubmitMessage('Please fix the errors below and try again.');
      } else if (response.success) {
        setSubmitMessage('Form submitted successfully! 🎉');
      }
    } catch (error) {
      setSubmitMessage('Network error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="demo-container">
      <h1>Master Form with Widget Error Handling Demo</h1>
      <p className="demo-description">
        This demo shows how to handle field-level errors from an API and display them in specific widget forms.
        Try submitting with invalid data to see the error handling in action!
      </p>
      
      <div className="master-form">
        <UserProfileWidget
          onDataChange={(data) => handleWidgetDataChange('userProfile', data)}
          errors={errors.userProfile || {}}
        />
        
        <PreferencesWidget
          onDataChange={(data) => handleWidgetDataChange('preferences', data)}
          errors={errors.preferences || {}}
        />
        
        <AddressWidget
          onDataChange={(data) => handleWidgetDataChange('address', data)}
          errors={errors.address || {}}
        />
        
        <div className="submit-section">
          <button 
            type="button" 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`submit-button ${isSubmitting ? 'submitting' : ''}`}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Form'}
          </button>
          
          {submitMessage && (
            <div className={`submit-message ${submitMessage.includes('success') ? 'success' : 'error'}`}>
              {submitMessage}
            </div>
          )}
        </div>
              </div>
      
      <div className="debug-section">
        <h3>Current Form Data (Debug)</h3>
        <pre className="debug-data">{JSON.stringify(formData, null, 2)}</pre>
      </div>
      
      <style jsx>{`
        .demo-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        h1 {
          color: #2c3e50;
          margin-bottom: 10px;
        }
        
        .demo-description {
          color: #7f8c8d;
          margin-bottom: 30px;
          line-height: 1.5;
        }
        
        .master-form {
          display: grid;
          gap: 25px;
          margin-bottom: 30px;
        }
        
        .widget-form {
          border: 2px solid #ecf0f1;
          border-radius: 8px;
          padding: 20px;
          background: #ffffff;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .widget-title {
          margin: 0 0 20px 0;
          color: #2c3e50;
          border-bottom: 2px solid #3498db;
          padding-bottom: 8px;
        }
        
        .field-group {
          margin-bottom: 16px;
        }
        
        .field-label {
          display: block;
          margin-bottom: 6px;
          font-weight: 600;
          color: #34495e;
        }
        
        .input {
          width: 100%;
          padding: 10px 12px;
          border: 2px solid #bdc3c7;
          border-radius: 4px;
          font-size: 14px;
          transition: border-color 0.2s;
        }
        
        .input:focus {
          outline: none;
          border-color: #3498db;
        }
        
        .input-error {
          border-color: #e74c3c;
        }
        
        .field-error {
          color: #e74c3c;
          font-size: 13px;
          margin-top: 4px;
          padding: 4px 0;
        }
        
        .field-row {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 12px;
        }
        
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-weight: normal;
        }
        
        .submit-section {
          text-align: center;
          margin-top: 30px;
        }
        
        .submit-button {
          background: #3498db;
          color: white;
          border: none;
          padding: 14px 28px;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .submit-button:hover:not(:disabled) {
          background: #2980b9;
          transform: translateY(-1px);
        }
        
        .submit-button:disabled {
          background: #95a5a6;
          cursor: not-allowed;
          transform: none;
        }
        
        .submit-button.submitting {
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }
        
        .submit-message {
          margin-top: 16px;
          padding: 12px;
          border-radius: 4px;
          font-weight: 600;
        }
        
        .submit-message.success {
          background: #d5f4e6;
          color: #27ae60;
          border: 1px solid #27ae60;
        }
        
        .submit-message.error {
          background: #fdf2f2;
          color: #e74c3c;
          border: 1px solid #e74c3c;
        }
        
        .debug-section {
          border-top: 2px solid #ecf0f1;
          padding-top: 20px;
          margin-top: 20px;
        }
        
        .debug-section h3 {
          color: #7f8c8d;
          margin-bottom: 10px;
        }
        
        .debug-data {
          background: #2c3e50;
          color: #ecf0f1;
          padding: 15px;
          border-radius: 4px;
          overflow: auto;
          font-size: 12px;
          max-height: 300px;
        }
      `}</style>
    </div>
  );
};

export default MasterForm;