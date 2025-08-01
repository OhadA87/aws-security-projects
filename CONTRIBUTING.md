# Contributing to AWS Security Projects

We welcome contributions to the AWS Security Projects repository!
This document provides guidelines for contributing to ensure high-quality, secure, and consistent code.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Security Requirements](#security-requirements)
- [Testing](#testing)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)

## Code of Conduct

This project adheres to a professional code of conduct. By participating, you are expected to uphold high standards of collaboration and respect.

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- AWS CLI configured with appropriate permissions
- AWS CDK CLI installed globally
- Python 3.11+ (for Lambda functions)
- Git and GitHub account

### Development Environment Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/aws-security-projects.git
   cd aws-security-projects
   ```

2. **Install Dependencies**
   ```bash
   # For CDK projects
   cd Domain4-Identity_and_Access_Management/Project1A-Multi_Identity_Provider_Federation
   npm install
   ```

3. **Configure Environment**
   ```bash
   # Set up AWS credentials
   aws configure

   # Bootstrap CDK (if needed)
   cdk bootstrap
   ```

## Development Workflow

### Branch Strategy

We follow GitFlow with Israeli high-tech modifications:

- **main**: Production-ready code
- **develop**: Integration branch for features
- **feature/**: Feature development (`feature/domain4-saml-integration`)
- **hotfix/**: Critical production fixes (`hotfix/security-patch-v1.2.1`)
- **release/**: Release preparation (`release/v1.2.0`)

### Branch Naming Convention

```
feature/domain[X]-[brief-description]
hotfix/[issue-description]
release/v[major].[minor].[patch]
```

Examples:
- `feature/domain4-multi-idp-federation`
- `hotfix/iam-policy-vulnerability`
- `release/v1.3.0`

### Commit Message Format

Use conventional commits:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding or modifying tests
- `chore`: Maintenance tasks
- `security`: Security-related changes

**Examples:**
```
feat(domain4): add SAML identity provider configuration

sec(iam): implement least privilege access patterns

fix(monitoring): resolve CloudWatch metric collection issue
```

## Coding Standards

### TypeScript/CDK Guidelines

1. **Code Style**
   - Use ESLint and Prettier configurations
   - Run `npm run lint` and `npm run format` before committing
   - Follow TypeScript strict mode

2. **Naming Conventions**
   - Classes: PascalCase (`IdentityProviderStack`)
   - Functions/Variables: camelCase (`createPermissionSet`)
   - Constants: UPPER_SNAKE_CASE (`MAX_SESSION_DURATION`)
   - Files: kebab-case (`identity-provider-stack.ts`)

3. **CDK Best Practices**
   - Use construct props interfaces
   - Implement proper resource tagging
   - Follow AWS Well-Architected patterns
   - Use CDK NAG for security scanning

### Infrastructure as Code

1. **Security First**
   - Enable encryption by default
   - Use least privilege access
   - Implement proper resource boundaries
   - Add security scanning with CDK NAG

2. **Resource Management**
   - Use removal policies appropriately
   - Implement proper resource naming
   - Add comprehensive tagging
   - Use environment-specific configurations

### Documentation

1. **Code Documentation**
   - Add JSDoc comments for public methods
   - Document complex logic and security decisions
   - Include examples in interface documentation

2. **Architecture Documentation**
   - Update architecture diagrams for significant changes
   - Document security considerations
   - Include deployment instructions

## Security Requirements

### Security Scanning

All code must pass security scans:

```bash
# Run security scans locally
npm run security:scan

# CDK NAG scanning
npx cdk-nag --app='npx ts-node bin/app.ts'
```

### Security Checklist

- [ ] No hardcoded secrets or credentials
- [ ] Encryption enabled for data at rest and in transit
- [ ] Least privilege IAM policies
- [ ] Proper resource boundaries and isolation
- [ ] Security scanning passes (Checkov, Semgrep, Snyk)
- [ ] CloudTrail logging enabled for audit trails

### Sensitive Data Handling

- Never commit secrets, keys, or credentials
- Use AWS Secrets Manager or Parameter Store
- Implement proper key rotation
- Use KMS for encryption key management

## Testing

### Test Types

1. **Unit Tests**
   ```bash
   npm test
   npm run test:coverage
   ```

2. **CDK Snapshot Tests**
   ```bash
   npm run cdk synth
   npm run test:snapshot
   ```

3. **Security Tests**
   ```bash
   npm run security:scan
   ```

### Test Requirements

- Minimum 80% code coverage
- All security scans must pass
- CDK synthesis must succeed
- No high/critical security findings

## Pull Request Process

### Before Creating a PR

1. **Code Quality**
   ```bash
   npm run lint
   npm run format
   npm test
   npm run security:scan
   ```

2. **CDK Validation**
   ```bash
   cdk synth
   cdk diff
   ```

3. **Documentation**
   - Update README if needed
   - Add/update architectural documentation
   - Include deployment instructions

### PR Template

Use the provided PR template:

- **Description**: Clear description of changes
- **Type of Change**: Feature, bug fix, documentation, etc.
- **Security Impact**: Assessment of security implications
- **Testing**: Description of testing performed
- **Checklist**: Complete all required items

### Review Process

1. **Automated Checks**
   - CI/CD pipeline must pass
   - Security scans must pass
   - Code coverage requirements met

2. **Manual Review**
   - Code review by 2+ team members
   - Security review for sensitive changes
   - Architecture review for significant changes

3. **Approval Requirements**
   - 2 approvals for feature branches
   - Security team approval for security-related changes
   - Platform team approval for infrastructure changes

## Environment Management

### Development Environment
- Feature testing and development
- Automatic deployment from `develop` branch
- Minimal security controls for rapid iteration

### Staging Environment
- Pre-production validation
- Automatic deployment from `main` branch
- Production-like security controls
- Integration testing

### Production Environment
- Live environment
- Manual deployment approval required
- Full security controls and monitoring
- Comprehensive logging and alerting

## Release Process

### Release Preparation

1. **Create Release Branch**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b release/v1.2.0
   ```

2. **Update Version Numbers**
   - Update package.json versions
   - Update documentation
   - Create CHANGELOG entry

3. **Final Testing**
   - Run complete test suite
   - Perform security scans
   - Validate deployment scripts

### Release Deployment

1. **Merge to Main**
   ```bash
   git checkout main
   git merge release/v1.2.0
   git tag v1.2.0
   git push origin main --tags
   ```

2. **Production Deployment**
   - Triggered automatically via GitHub Actions
   - Requires manual approval
   - Includes rollback procedures

## Israeli High-Tech Best Practices

### Code Quality
- Zero tolerance for security vulnerabilities
- Comprehensive testing and validation
- Clean, maintainable code architecture
- Proper error handling and logging

### Collaboration
- Async-first communication
- Comprehensive code reviews
- Knowledge sharing through documentation
- Continuous learning and improvement

### Security
- Security by design principles
- Regular security assessments
- Incident response procedures
- Compliance with SOC 2 and ISO 27001

## Getting Help

- **Technical Questions**: Create GitHub issue
- **Security Concerns**: Contact security team directly
- **Architecture Discussions**: Schedule architecture review
- **General Questions**: Check existing documentation first

## Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS Security Best Practices](https://aws.amazon.com/architecture/security-identity-compliance/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Conventional Commits](https://www.conventionalcommits.org/)

Thank you for contributing to AWS Security Projects! 🚀
