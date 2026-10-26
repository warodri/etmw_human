import { createLexiconRepository } from "./repositories/repository.factory.js";
import { TaggingService } from "./services/tagging.service.js";

const lexiconRepository = createLexiconRepository();

export const taggingService = new TaggingService(lexiconRepository);
