// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette demo

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
