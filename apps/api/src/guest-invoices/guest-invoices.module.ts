import { Module } from "@nestjs/common";
import { BusinessesModule } from "../businesses/businesses.module.js";
import { ClientsModule } from "../clients/clients.module.js";
import { InvoicesModule } from "../invoices/invoices.module.js";
import { GuestInvoicesController } from "./guest-invoices.controller.js";
import { GuestInvoicesService } from "./guest-invoices.service.js";

@Module({
  imports: [BusinessesModule, ClientsModule, InvoicesModule],
  controllers: [GuestInvoicesController],
  providers: [GuestInvoicesService],
})
export class GuestInvoicesModule {}
