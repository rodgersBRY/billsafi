import { Module } from "@nestjs/common";
import { BusinessesModule } from "../businesses/businesses.module.js";
import { InvoicesModule } from "../invoices/invoices.module.js";
import { QuoteConversionService } from "./quote-conversion.service.js";
import { QuoteLinksService } from "./quote-links.service.js";
import { QuoteResponsesService } from "./quote-responses.service.js";
import { PublicQuotesController, QuotesController } from "./quotes.controller.js";
import { QuotesService } from "./quotes.service.js";

@Module({
  imports: [BusinessesModule, InvoicesModule],
  controllers: [QuotesController, PublicQuotesController],
  providers: [QuotesService, QuoteLinksService, QuoteConversionService, QuoteResponsesService],
})
export class QuotesModule {}
