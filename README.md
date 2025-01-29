# ValidYML VSCode Extension

## Overview
ValidYML VSCode Extension is a powerful tool designed to enhance your Kubernetes YAML development experience by providing real-time validation, best practice enforcement, and automatic cleanup of Kubernetes configuration files directly within Visual Studio Code.

## Features

### 1. Real-Time Kubernetes YAML Validation
- Automatic validation as you type
- Immediate feedback on errors and warnings
- Checks for:
  - Required fields (kind, apiVersion)
  - Resource specifications
  - Security best practices
  - Common configuration mistakes

### 2. Smart Cleaning and Formatting
- One-click cleanup of Kubernetes YAML files
- Removes redundant and default values
- Eliminates empty/null fields
- Consistent YAML formatting
- Reduces file size and improves readability

### 3. Security Checks
- Identifies potential security risks
- Warns about:
  - Use of privileged containers
  - Host network access
  - Latest image tags
  - Missing resource limits
  - Unsafe configurations

### 4. Best Practices Enforcement
- Resource limits and requests validation
- Namespace usage checks
- Image tag validation
- API version verification
- Configuration optimization suggestions

## Installation

1. Open Visual Studio Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "ValidYML"
4. Click Install

Or install from VS Code Marketplace: [ValidYML Extension](#)

## Usage

### Commands
Access these commands through the Command Palette (Ctrl+Shift+P):
- `validyml: Validate Current File` - Manually trigger validation
- `validyml: Clean Current File` - Clean and format the current file

### Automatic Validation
- Opens automatically for `.yaml` and `.yml` files
- Shows problems in the Problems panel
- Provides inline diagnostics and quick fixes

### Configuration
In VS Code settings:
```json
{
    "validyml.enableAutoValidation": true
}
```

## Examples

### Validation Example
Before:
```yaml
apiVersion: v1
kind: Pod
spec:
  containers:
  - image: nginx:latest
```

Validation will show:
- Warning: Container is missing resource limits/requests
- Warning: Using latest tag is not recommended

### Cleaning Example
Before:
```yaml
apiVersion: v1
kind: Service
metadata:
  namespace: default
spec:
  ports:
  - port: 80
    protocol: TCP
  selector:
    app: null
```

After:
```yaml
apiVersion: v1
kind: Service
spec:
  ports:
  - port: 80
  selector: {}
```

## Requirements
- Visual Studio Code version 1.80.0 or higher
- Kubernetes YAML files

## Extension Settings
This extension contributes the following settings:

- `validyml.enableAutoValidation`: Enable/disable automatic validation
- `validyml.validateOnSave`: Enable/disable validation on save
- `validyml.severity.missingResources`: Set severity level for missing resources warning

## Known Issues
- Large YAML files might experience slight validation delays
- Some advanced Kubernetes CRDs might not be fully supported

## Release Notes

### 0.1.0
Initial release of ValidYML VSCode Extension:
- Basic YAML validation
- File cleaning functionality
- Security checks
- Best practices enforcement

## Contributing
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Support
For support, please open an issue in the GitHub repository or contact the maintainers.

## Acknowledgments
- Based on the ValidYML project
- Uses YAML parsing from yaml.js
- Inspired by Kubernetes best practices

## Authors
Animesh Pathak - [Sonichigo](https://github.com/sonichigo)

## Project Status
Active development - Contributions welcome!