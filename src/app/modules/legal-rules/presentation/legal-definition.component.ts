import { NgTemplateOutlet } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ROUNDING_MODES } from '../../payroll-engine/domain/engine.models';
import { LegalDraft } from '../domain/legal-draft';
import { LegalCategory } from '../domain/legal-navigation';

@Component({
  selector: 'app-legal-definition', standalone: true,
  imports: [FormsModule, NgTemplateOutlet], templateUrl: './legal-definition.component.html',
})
export class LegalDefinitionComponent {
  @Input({ required: true }) draft!: LegalDraft;
  @Input({ required: true }) category!: 'general' | LegalCategory;
  @Input() editable = false;
  @Input() creating = false;
  protected readonly modes = ROUNDING_MODES;
  protected readonly taxError = LegalDraft.checkBrackets;
}
