import { SetMetadata } from '@nestjs/common';
import { REGISTRY_METADATA_KEY } from './listener.registry';

export const Listener = (eventsNames: string | string[]) => SetMetadata(REGISTRY_METADATA_KEY, eventsNames);
