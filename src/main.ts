import { bootstrapApplication } from '@angular/platform-browser';
import { initializeLocale } from './app/core/i18n/locale';
import { register as registerSwiperElements } from 'swiper/element/bundle';

registerSwiperElements();

initializeLocale()
  .then(async () => {
    const [{ AppComponent }, { appConfig }] = await Promise.all([
      import('./app/app.component'), import('./app/app.config'),
    ]);
    return bootstrapApplication(AppComponent, appConfig);
  })
  .catch((err) => console.error(err));
