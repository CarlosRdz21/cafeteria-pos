import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

console.info('[LOCAL] Modo local activo. API y Socket.IO: http://localhost:3000');

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
