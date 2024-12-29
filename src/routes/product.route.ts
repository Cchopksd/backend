import { Router } from "express";
import { ProductService } from "../services/product.service";

export class ProductRouter {
  public router: Router;
  private productService: ProductService;

  constructor(productService: ProductService) {
    this.router = Router();
    this.productService = productService;
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get("/get-all", async (req, res) => {
      const products = await this.productService.getAllProducts();
      res.json(products);
    });
  }
}
