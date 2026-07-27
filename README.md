# AI Workflow Builder

A no-code automation platform where users describe repetitive work in plain English and the system converts it into executable workflows.

## Getting Started

### Prerequisites
- Node.js 20+
- Docker and Docker Compose
- PostgreSQL 15+ (if running without Docker)

### Local Development with Docker

```bash
# Clone and install dependencies
npm install

# Copy example environment file
cp .env.example .env

# Start database and app with Docker Compose
docker-compose up
```

The API will be available at `http://localhost:3000`

### Local Development without Docker

```bash
# Install dependencies
npm install

# Set up PostgreSQL database
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/workflow_builder

# Start the development server
npm run dev
```

## API Endpoints

### Health Check
- `GET /health` - Health check endpoint with database connectivity status

### Workflows
- `GET /workflows` - List all workflows
- `GET /workflows/:id` - Get workflow and its steps
- `POST /workflows` - Create a new workflow
  - Body: `{ name: string, description?: string, enabled?: boolean }`

### Steps
- `POST /workflows/:id/steps` - Add a step to a workflow
  - Body: `{ type: string, config?: object, order: number }`

## Database Schema

### Workflows Table
- `id` (SERIAL PRIMARY KEY)
- `name` (VARCHAR 255, NOT NULL)
- `description` (TEXT)
- `enabled` (BOOLEAN, DEFAULT true)
- `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
- `updated_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)

### Steps Table
- `id` (SERIAL PRIMARY KEY)
- `workflow_id` (INTEGER, FK to workflows)
- `type` (VARCHAR 50, NOT NULL)
- `config` (JSONB)
- `order` (INTEGER, NOT NULL)
- `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
- `updated_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)

## Testing

```bash
npm test
```

## Project Structure

```
src/
├── index.js       - Application entry point
├── app.js         - Express application and routes
├── db.js          - Database connection and schema initialization
├── app.test.js    - Application tests
└── db.test.js     - Database tests
```