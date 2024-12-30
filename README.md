# Restaurant Backend

A Node.js backend service use oop concept.

## Tech Stack

- Node.js
- Express.js
- TypeScript
- Prisma ORM
- PostgreSQL
- Zod for validation
- ESLint for linting

## Setup

1. Install dependencies:

```bash
npm install

2. Run database migrations:
npx prisma migrate dev

3. Start development server:
npm run dev
```

## Project Structure

```bash
src/
├── app.ts # Express app configuration
├── server.ts # Server entry point
├── routes/ # API route definitions
├── controllers/ # Route controllers
├── services/ # Business logic
├── models/ # Prisma schema models
├── middlewares/ # Custom middleware
├── utils/ # Utility classes
└── validations/ # Zod validation schemas

Error Handling
The application uses custom exception handling through the HttpException class with specific error types like:

BadRequestException (400)
UnauthorizedException (401)
ForbiddenException (403)
NotFoundException (404)
InternalServerErrorException (500)
```
