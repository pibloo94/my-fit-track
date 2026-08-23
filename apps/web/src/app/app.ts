import { ChangeDetectionStrategy, Component } from '@angular/core';

import { AppShell } from './layout/app-shell';

@Component({
  selector: 'mft-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppShell],
  template: `<mft-app-shell />`,
})
export class App {}
