import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule, FormArray, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectButtonModule } from 'primeng/selectbutton';
import { FileUploadModule } from 'primeng/fileupload';
import { FormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';
import { RadioButtonModule } from 'primeng/radiobutton';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { QuizService, Quiz, Question } from '../../core/services/quiz.service';

@Component({
  selector: 'app-quiz-builder',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    DragDropModule,
    CardModule, InputTextModule, InputTextareaModule, InputNumberModule,
    ButtonModule, DialogModule, SelectButtonModule, FormsModule,
    FileUploadModule, CheckboxModule, RadioButtonModule, TagModule,
  ],
  template: `
    <div class="builder-page">
      <!-- Top bar -->
      <header class="builder-header">
        <p-button icon="pi pi-arrow-left" [text]="true" routerLink="/dashboard" />
        <h2>{{ quizId ? 'Edit Quiz' : 'New Quiz' }}</h2>
        <p-button
          label="Save Quiz"
          icon="pi pi-check"
          [loading]="saving"
          (onClick)="saveQuiz()"
        />
      </header>

      <div class="builder-body">
        <!-- Left: quiz metadata -->
        <p-card header="Quiz Details" styleClass="builder-meta">
          <form [formGroup]="metaForm">
            <div class="field">
              <label>Title *</label>
              <input pInputText formControlName="title" placeholder="My Awesome Quiz" class="w-full" />
            </div>
            <div class="field">
              <label>Description</label>
              <textarea
                pInputTextarea
                formControlName="description"
                rows="3"
                class="w-full"
                placeholder="What is this quiz about?"
              ></textarea>
            </div>
            <div class="field">
              <label>Default Time Limit (seconds)</label>
              <p-inputNumber
                formControlName="defaultTimeLimitSec"
                [min]="5" [max]="300"
                placeholder="No limit"
                class="w-full"
              />
              <small class="hint">Leave empty for host-controlled pacing</small>
            </div>
          </form>
        </p-card>

        <!-- Right: question list -->
        <div class="builder-questions">
          <div class="questions-header">
            <h3>Questions ({{ questions.length }})</h3>
            <p-button
              label="Add Question"
              icon="pi pi-plus"
              severity="secondary"
              (onClick)="openQuestionEditor()"
            />
          </div>

          <div *ngIf="questions.length === 0" class="no-questions">
            <i class="pi pi-list" style="font-size:2rem;color:var(--text-color-secondary)"></i>
            <p>No questions yet. Add your first one!</p>
          </div>

          <!-- CDK drag-and-drop list -->
          <div
            *ngIf="questions.length > 0"
            cdkDropList
            (cdkDropListDropped)="onDrop($event)"
            class="cdk-question-list"
          >
            <div
              *ngFor="let q of questions; let i = index"
              cdkDrag
              class="question-row"
            >
              <!-- Drag handle -->
              <span cdkDragHandle class="drag-handle">
                <i class="pi pi-bars"></i>
              </span>

              <div class="question-row-left">
                <span class="q-index">{{ i + 1 }}</span>
                <div class="q-info">
                  <span class="q-body">{{ q.body || '(image question)' }}</span>
                  <div class="q-meta">
                    <p-tag [value]="q.type === 'single' ? 'Single' : 'Multi'" severity="info" />
                    <span class="q-points">{{ q.points }} pts</span>
                    <span *ngIf="q.image_url" class="q-has-image">
                      <i class="pi pi-image"></i> image
                    </span>
                  </div>
                </div>
              </div>

              <div class="question-row-actions">
                <p-button
                  icon="pi pi-pencil"
                  [text]="true"
                  severity="secondary"
                  (onClick)="openQuestionEditor(q)"
                />
                <p-button
                  icon="pi pi-trash"
                  [text]="true"
                  severity="danger"
                  (onClick)="deleteQuestion(q)"
                />
              </div>

              <!-- CDK drag preview placeholder -->
              <div *cdkDragPlaceholder class="drag-placeholder"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Question editor dialog -->
    <p-dialog
      [(visible)]="editorVisible"
      [header]="editingQuestion ? 'Edit Question' : 'Add Question'"
      [modal]="true"
      [style]="{ width: '600px' }"
      [draggable]="false"
    >
      <form [formGroup]="qForm" class="q-editor">
        <div class="field">
          <label>Answer Type</label>
          <p-selectButton
            formControlName="type"
            [options]="typeOptions"
            optionLabel="label"
            optionValue="value"
          />
        </div>

        <div class="field">
          <label>Question Text</label>
          <textarea
            pInputTextarea
            formControlName="body"
            rows="3"
            class="w-full"
            placeholder="What is the question?"
          ></textarea>
        </div>

        <div class="field">
          <label>Image (optional)</label>
          <p-fileUpload
            mode="basic"
            accept="image/*"
            [maxFileSize]="5000000"
            chooseLabel="Choose Image"
            (onSelect)="onImageSelect($event)"
          />
          <div *ngIf="imagePreview" class="image-preview">
            <img [src]="imagePreview" alt="Preview" />
            <p-button icon="pi pi-times" [text]="true" severity="danger" (onClick)="clearImage()" />
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label>Time Limit (sec)</label>
            <p-inputNumber formControlName="timeLimitSec" [min]="5" [max]="300" placeholder="Use quiz default" />
          </div>
          <div class="field">
            <label>Points</label>
            <p-inputNumber formControlName="points" [min]="10" [max]="1000" />
          </div>
        </div>

        <div class="field">
          <div class="options-header">
            <label>Answer Options</label>
            <p-button
              label="Add Option"
              icon="pi pi-plus"
              [text]="true"
              severity="secondary"
              (onClick)="addOption()"
              [disabled]="optionsArray.length >= 6"
            />
          </div>

          <div
            *ngFor="let opt of optionsArray.controls; let i = index"
            [formGroup]="asGroup(opt)"
            class="option-row"
          >
            <ng-container *ngIf="qForm.get('type')?.value === 'single'">
              <button
                type="button"
                class="correct-toggle"
                [class.is-correct]="qForm.get('correctIndex')?.value === i"
                (click)="qForm.get('correctIndex')?.setValue(i)"
                title="Mark as correct"
              >
                <i class="pi pi-check"></i>
              </button>
            </ng-container>
            <ng-container *ngIf="qForm.get('type')?.value === 'multi'">
              <p-checkbox formControlName="isCorrect" [binary]="true" />
            </ng-container>
            <input pInputText formControlName="body" placeholder="Option text" class="flex-1" />
            <p-button
              icon="pi pi-trash"
              [text]="true"
              severity="danger"
              (onClick)="removeOption(i)"
              [disabled]="optionsArray.length <= 2"
            />
          </div>

          <small class="hint" *ngIf="qForm.get('type')?.value === 'single'">
            Select the radio button next to the correct answer
          </small>
          <small class="hint" *ngIf="qForm.get('type')?.value === 'multi'">
            Check all correct answers
          </small>
        </div>
      </form>

      <ng-template pTemplate="footer">
        <p-button label="Cancel" severity="secondary" [text]="true" (onClick)="editorVisible = false" />
        <p-button
          [label]="editingQuestion ? 'Save Changes' : 'Add Question'"
          icon="pi pi-check"
          [loading]="savingQuestion"
          (onClick)="submitQuestion()"
        />
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .builder-page { min-height: 100vh; background: var(--surface-ground); }
    .builder-header {
      display: flex; align-items: center; gap: 1rem;
      padding: 1rem 2rem;
      background: var(--surface-card);
      border-bottom: 1px solid var(--surface-border);
    }
    .builder-header h2 { margin: 0; flex: 1; font-size: 1.25rem; font-weight: 700; }
    .builder-body {
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 1.5rem;
      max-width: 1100px;
      margin: 0 auto;
      padding: 2rem;
    }
    .field { margin-bottom: 1.25rem; }
    .field label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
    .hint { color: var(--text-color-secondary); font-size: 0.8rem; }
    .questions-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 1rem;
    }
    .questions-header h3 { margin: 0; font-size: 1.1rem; font-weight: 700; }
    .no-questions {
      text-align: center; padding: 3rem;
      border: 2px dashed var(--surface-border); border-radius: 8px;
      color: var(--text-color-secondary);
    }
    .correct-toggle {
      width: 28px; height: 28px; border-radius: 50%;
      border: 2px solid var(--surface-border);
      background: transparent; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: transparent; flex-shrink: 0; transition: all 0.15s;
    }
    .correct-toggle.is-correct {
      background: #22c55e; border-color: #22c55e; color: white;
    }

    /* CDK drag-drop list */
    .cdk-question-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .question-row {
      display: flex; align-items: center;
      gap: 0.75rem; padding: 0.75rem;
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: 8px;
      cursor: default;
    }
    .question-row:hover { border-color: var(--primary-color); }
    .drag-handle {
      cursor: grab; color: var(--text-color-secondary);
      padding: 0.25rem; flex-shrink: 0;
    }
    .drag-handle:active { cursor: grabbing; }
    .drag-placeholder {
      height: 60px;
      background: var(--surface-ground);
      border: 2px dashed var(--primary-color);
      border-radius: 8px;
    }
    .cdk-drag-preview {
      background: var(--surface-card);
      border: 1px solid var(--primary-color);
      border-radius: 8px;
      padding: 0.75rem;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    }
    .cdk-drag-animating { transition: transform 250ms cubic-bezier(0,0,0.2,1); }

    .question-row-left { display: flex; align-items: center; gap: 0.75rem; flex: 1; }
    .q-index {
      width: 28px; height: 28px; border-radius: 50%;
      background: var(--primary-color); color: white;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.8rem; font-weight: 700; flex-shrink: 0;
    }
    .q-body { font-weight: 500; display: block; }
    .q-meta { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem; }
    .q-points { font-size: 0.8rem; color: var(--text-color-secondary); }
    .q-has-image { font-size: 0.8rem; color: var(--text-color-secondary); }
    .question-row-actions { display: flex; }

    .q-editor { display: flex; flex-direction: column; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .options-header {
      display: flex; align-items: center;
      justify-content: space-between; margin-bottom: 0.75rem;
    }
    .option-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
    .image-preview { position: relative; display: inline-block; margin-top: 0.5rem; }
    .image-preview img { max-height: 120px; border-radius: 6px; }
  `],
})
export class QuizBuilderComponent implements OnInit {
  private fb     = inject(FormBuilder);
  private qs     = inject(QuizService);
  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  private toast  = inject(MessageService);

  quizId: string | null   = null;
  questions: Question[]   = [];
  saving         = false;
  savingQuestion = false;
  editorVisible  = false;
  editingQuestion: Question | null = null;
  imageFile: File | null   = null;
  imagePreview: string | null = null;

  typeOptions = [
    { label: 'Single Choice', value: 'single' },
    { label: 'Multiple Choice', value: 'multi' },
  ];

  metaForm = this.fb.group({
    title:               ['', Validators.required],
    description:         [''],
    defaultTimeLimitSec: [null as number | null],
  });

  qForm = this.fb.group({
    type:         ['single'],
    body:         [''],
    timeLimitSec: [null as number | null],
    points:       [100],
    correctIndex: [0],
    options:      this.fb.array([this.newOption(), this.newOption()]),
  });

  get optionsArray(): FormArray { return this.qForm.get('options') as FormArray; }
  asGroup(c: any): FormGroup   { return c as FormGroup; }

  ngOnInit(): void {
    this.quizId = this.route.snapshot.paramMap.get('id');
    if (this.quizId) {
      this.qs.getQuiz(this.quizId).subscribe((res) => {
        const q = res.quiz;
        this.metaForm.patchValue({
          title:               q.title,
          description:         q.description,
          defaultTimeLimitSec: q.default_time_limit_sec,
        });
        this.questions = q.questions || [];
      });
    }
  }

  saveQuiz(): void {
    if (this.metaForm.invalid) return;
    this.saving = true;

    const req$ = this.quizId
      ? this.qs.updateQuiz(this.quizId, this.metaForm.value as any)
      : this.qs.createQuiz(this.metaForm.value as any);

    req$.subscribe({
      next: (res) => {
        this.saving = false;
        this.quizId = res.quiz.id;
        this.toast.add({ severity: 'success', summary: 'Saved', detail: 'Quiz saved successfully' });
        if (!this.route.snapshot.paramMap.get('id')) {
          this.router.navigate(['/quiz', res.quiz.id, 'edit'], { replaceUrl: true });
        }
      },
      error: () => {
        this.saving = false;
        this.toast.add({ severity: 'error', summary: 'Error', detail: 'Could not save quiz' });
      },
    });
  }

  // CDK drop handler 
  onDrop(event: CdkDragDrop<Question[]>): void {
    moveItemInArray(this.questions, event.previousIndex, event.currentIndex);
    if (this.quizId) {
      this.qs.reorderQuestions(this.quizId, this.questions.map((q) => q.id)).subscribe();
    }
  }

  openQuestionEditor(q?: Question): void {
    this.editingQuestion = q || null;
    this.imageFile       = null;
    this.imagePreview    = q?.image_url || null;

    while (this.optionsArray.length) this.optionsArray.removeAt(0);

    if (q) {
      q.options.forEach((o) => {
        const g = this.newOption(o.body);
        g.patchValue({ isCorrect: o.is_correct });
        this.optionsArray.push(g);
      });
      const correctIdx = q.options.findIndex((o) => o.is_correct);
      this.qForm.patchValue({
        type:         q.type,
        body:         q.body || '',
        timeLimitSec: q.time_limit_sec,
        points:       q.points,
        correctIndex: correctIdx >= 0 ? correctIdx : 0,
      });
    } else {
      this.optionsArray.push(this.newOption());
      this.optionsArray.push(this.newOption());
      this.qForm.reset({ type: 'single', points: 100, correctIndex: 0 });
    }

    this.editorVisible = true;
  }

  submitQuestion(): void {
    if (!this.quizId) {
      this.toast.add({
        severity: 'warn',
        summary:  'Save quiz first',
        detail:   'Save quiz metadata before adding questions',
      });
      return;
    }

    const v       = this.qForm.value;
    const options = this.optionsArray.controls.map((c, i) => ({
      body:      (c as FormGroup).get('body')?.value,
      isCorrect: v.type === 'single'
        ? i === v.correctIndex
        : (c as FormGroup).get('isCorrect')?.value,
    }));

    const fd = new FormData();
    if (v.body)         fd.append('body', v.body);
    if (v.type)         fd.append('type', v.type);
    if (v.timeLimitSec) fd.append('timeLimitSec', String(v.timeLimitSec));
    if (v.points)       fd.append('points', String(v.points));
    fd.append('options', JSON.stringify(options));
    if (this.imageFile) fd.append('image', this.imageFile);

    this.savingQuestion = true;

    const req$ = this.editingQuestion
      ? this.qs.updateQuestion(this.quizId, this.editingQuestion.id, fd)
      : this.qs.createQuestion(this.quizId, fd);

    req$.subscribe({
      next: (res) => {
        this.savingQuestion = false;
        this.editorVisible  = false;
        if (this.editingQuestion) {
          this.questions = this.questions.map((q) =>
            q.id === res.question.id ? res.question : q
          );
        } else {
          this.questions = [...this.questions, res.question];
        }
        this.toast.add({ severity: 'success', summary: 'Saved', detail: 'Question saved' });
      },
      error: (err) => {
        this.savingQuestion = false;
        this.toast.add({
          severity: 'error',
          summary:  'Error',
          detail:   err.error?.error || 'Could not save question',
        });
      },
    });
  }

  deleteQuestion(q: Question): void {
    if (!this.quizId) return;
    this.qs.deleteQuestion(this.quizId, q.id).subscribe({
      next: () => {
        this.questions = this.questions.filter((x) => x.id !== q.id);
        this.toast.add({ severity: 'success', summary: 'Deleted', detail: 'Question removed' });
      },
    });
  }

  onImageSelect(event: any): void {
    const file = event.files[0];
    if (!file) return;
    this.imageFile    = file;
    const reader      = new FileReader();
    reader.onload     = (e) => { this.imagePreview = e.target?.result as string; };
    reader.readAsDataURL(file);
  }

  clearImage(): void {
    this.imageFile    = null;
    this.imagePreview = null;
  }

  addOption(): void    { this.optionsArray.push(this.newOption()); }
  removeOption(i: number): void { this.optionsArray.removeAt(i); }

  private newOption(body = ''): FormGroup {
    return this.fb.group({ body: [body, Validators.required], isCorrect: [false] });
  }
}