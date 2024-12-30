import express, { Application } from "express";
import cors from "cors";
import * as bodyParser from "body-parser";
import helmet from "helmet";
import morgan from "morgan";

import { ProductRouter } from "./routes/product.route";
import { ProductService } from "./services/product.service";
import { exceptionHandler } from "./middlewares/exceptionHandler";

class App {
  public app: Application;

  constructor() {
    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeExceptionHandler();
  }

  private initializeMiddlewares() {
    this.app.use(helmet());
    this.app.use(
      cors({
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        credentials: true,
      }),
    );
    this.app.use(morgan("dev"));

    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: true }));
  }
  private initializeRoutes() {
    const productService = new ProductService();
    const productRoutes = new ProductRouter(productService);
    this.app.use("/api/v1/product", productRoutes.router);
    this.handleNotFound();
  }

  private handleNotFound() {
    this.app.use("*", (req, res) => {
      res.status(404).json({
        status: "error",
        statusCode: 404,
        message: `Route ${req.originalUrl} not found`,
      });
    });
  }

  private initializeExceptionHandler() {
    this.app.use(exceptionHandler);
  }
}

export default new App().app;
