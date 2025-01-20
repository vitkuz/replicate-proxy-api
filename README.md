# Replicate API Proxy

A serverless AWS proxy service for Replicate API that provides job persistence, image storage, and status tracking.

## Architecture Overview

This project implements a serverless architecture using:
- AWS API Gateway for request handling
- AWS Lambda for serverless compute
- DynamoDB for job persistence
- S3 for image storage
- DynamoDB Streams for event processing
- DAX for DynamoDB caching

## Recommended Improvements

### 1. Error Handling & Reliability

- [x] Implement retry mechanism with exponential backoff
- [x] Add circuit breaker pattern for API calls
- [ ] Add Dead Letter Queues (DLQ) for Lambda functions
- [ ] Implement comprehensive error handling for image processing
- [ ] Add request validation in API Gateway
- [ ] Implement fallback mechanisms for critical operations

### 2. Performance & Cost Optimization

- [x] Implement DynamoDB DAX for caching
- [x] Add S3 lifecycle rules for cost optimization
- [ ] Implement batch operations for DynamoDB
- [ ] Add image compression before S3 upload
- [ ] Optimize Lambda memory allocation
- [ ] Use S3 Transfer Acceleration for large files
- [ ] Implement response caching in API Gateway

### 3. Security Improvements

- [x] Add WAF for API protection
- [x] Implement rate limiting
- [x] Use KMS encryption for sensitive data
- [ ] Implement JWT authentication
- [ ] Add request signing for S3 uploads
- [ ] Implement API key rotation
- [ ] Add IP whitelisting capabilities
- [ ] Implement VPC endpoints for enhanced security

### 4. Monitoring & Observability

- [x] Add structured logging
- [x] Implement request tracing
- [ ] Set up CloudWatch dashboards
- [ ] Add custom metrics for:
    - Job processing time
    - Success/failure rates
    - Image processing metrics
    - API latency
- [ ] Set up alerts for:
    - Error rate thresholds
    - Latency spikes
    - Cost anomalies
    - Storage capacity
- [ ] Implement distributed tracing with X-Ray

### 5. Code Organization

- [x] Implement proper TypeScript types
- [ ] Add service layer abstraction
- [ ] Create separate modules for:
    - Replicate API client
    - Image processing
    - Storage operations
    - Job management
- [ ] Add input validation schemas
- [ ] Implement proper dependency injection
- [ ] Add configuration management

### 6. Additional Features

- [ ] Implement webhook notifications for job status changes
- [ ] Add support for multiple Replicate models
- [ ] Create job queuing system
- [ ] Add job cancellation capability
- [ ] Implement automatic cleanup for old jobs
- [ ] Add support for batch job processing
- [ ] Create admin API for system management

### 7. Testing Strategy

- [ ] Add unit tests for:
    - Business logic
    - Utility functions
    - Service layer
- [ ] Implement integration tests for:
    - API endpoints
    - DynamoDB operations
    - S3 operations
- [ ] Add load testing scripts
- [ ] Implement chaos testing
- [ ] Add security testing
- [ ] Create performance benchmarks

### 8. CI/CD Pipeline

- [ ] Implement automated deployments
- [ ] Add infrastructure testing
- [ ] Implement security scanning
- [ ] Add automated rollbacks
- [ ] Set up multiple environments
- [ ] Implement blue-green deployments
- [ ] Add deployment validation tests

## Development Setup

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Deploy to AWS:
```bash
npm run cdk
```

## Environment Variables

Required environment variables:
- `REPLICATE_API_TOKEN`: SSM parameter name for Replicate API token
- `REPLICATE_PROXY_TABLE`: DynamoDB table name
- `IMAGES_BUCKET`: S3 bucket name for image storage

## API Documentation

### Create Job
```http
POST /
Content-Type: application/json

{
  "version": "string",
  "input": {
    "model": "string",
    "prompt": "string",
    ...
  }
}
```

### Get Job Status
```http
GET /?predictionId=<id>
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT