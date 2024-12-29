import { Request, Response } from "express";
import { ProductService } from "../services/product.service";

export class ProductController {
  private productService: ProductService;

  constructor() {
    this.productService = new ProductService();
  }

  public async getProducts(req: Request, res: Response) {
    try {
      const users = await this.productService.getAllProducts();
      res.status(200).json(users);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
}
