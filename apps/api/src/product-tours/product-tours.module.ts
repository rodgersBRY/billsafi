import { Module } from "@nestjs/common";
import { ProductToursController } from "./product-tours.controller.js";
import { ProductToursService } from "./product-tours.service.js";

@Module({
  controllers: [ProductToursController],
  providers: [ProductToursService],
})
export class ProductToursModule {}
