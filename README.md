# E-Commerce Backend API

Complete production-grade NestJS backend for a full e-commerce application.

## Tech Stack

- **Framework**: NestJS (latest) with TypeScript
- **Database**: PostgreSQL with TypeORM
- **Authentication**: JWT (access + refresh tokens)
- **Validation**: class-validator + class-transformer
- **Documentation**: Swagger/OpenAPI
- **Security**: bcrypt for password hashing

## Features

- ✅ Complete authentication system (register, login, refresh, logout)
- ✅ Role-based access control (Admin/Customer)
- ✅ Product management with categories
- ✅ Shopping cart functionality
- ✅ Order management with status tracking
- ✅ Payment processing
- ✅ Advanced product filtering and pagination
- ✅ Global error handling
- ✅ Response transformation
- ✅ Swagger documentation

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v13 or higher)
- npm or yarn

### Installation

1. Clone the repository

2. Install dependencies

```bash
npm install
```

3. Configure environment variables
```bash
cp .env.example .env
```

Edit `.env` file with your database credentials and JWT secrets.

4. Create PostgreSQL database
```sql
CREATE DATABASE ecommerce_db;
```

5. Run the application
```bash
npm run start:dev
```

The API will be available at `http://localhost:3000/api`

Swagger documentation: `http://localhost:3000/api/docs`

## API Endpoints

### Authentication - `/api/auth`
- `POST /register` - Register new user
- `POST /login` - User login
- `POST /refresh` - Refresh access token
- `POST /logout` - Logout user
- `GET /me` - Get current user profile

### Users - `/api/users` (Admin only)
- `GET /` - List all users (paginated)
- `GET /:id` - Get user by ID
- `PATCH /:id` - Update user
- `DELETE /:id` - Delete user

### Categories - `/api/categories`
- `GET /` - List all categories (public)
- `GET /:id` - Get category with products (public)
- `POST /` - Create category (Admin)
- `PATCH /:id` - Update category (Admin)
- `DELETE /:id` - Delete category (Admin)

### Products - `/api/products`
- `GET /` - List products with filters (public)
- `GET /:id` - Get product detail (public)
- `POST /` - Create product (Admin)
- `PATCH /:id` - Update product (Admin)
- `PATCH /:id/stock` - Update stock (Admin)
- `DELETE /:id` - Delete product (Admin)

### Cart - `/api/cart`
- `GET /` - Get current user cart
- `POST /items` - Add item to cart
- `PATCH /items/:itemId` - Update item quantity
- `DELETE /items/:itemId` - Remove item
- `DELETE /` - Clear cart

### Orders - `/api/orders`
- `POST /` - Create order from cart
- `GET /` - Get user orders
- `GET /:id` - Get order detail
- `PATCH /:id/cancel` - Cancel order
- `GET /admin/all` - List all orders (Admin)
- `PATCH /admin/:id/status` - Update order status (Admin)

### Payments - `/api/payments`
- `POST /` - Initiate payment
- `GET /:orderId` - Get payment status

## Database Schema

### Entities
- **User** - User accounts with roles
- **Category** - Product categories (supports subcategories)
- **Product** - Products with pricing, stock, images
- **Cart** - User shopping carts
- **CartItem** - Items in cart
- **Order** - Customer orders with status tracking
- **OrderItem** - Line items in orders
- **Payment** - Payment records

## Environment Variables

```env
PORT=3000
NODE_ENV=development

DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=ecommerce_db
DATABASE_USER=postgres
DATABASE_PASS=postgres

JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

## Description

Complete e-commerce backend with NestJS framework and TypeScript.

## Project setup

```bash
$ yarn install
```

## Compile and run the project

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod
```

## Run tests

```bash
# unit tests
$ yarn run test

# e2e tests
$ yarn run test:e2e

# test coverage
$ yarn run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ yarn install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
