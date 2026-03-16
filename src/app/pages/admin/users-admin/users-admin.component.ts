import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { UiDialogService } from '../../../core/services/ui-dialog.service';
import { User } from '../../../core/models/domain.models';
import { buildApiUrl } from '../../../core/config/server.config';

type UserForm = Omit<User, 'id' | 'createdAt'> & {
  id?: number;
  createdAt?: Date;
  passwordConfirm?: string;
};

@Component({
  selector: 'app-users-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule
  ],
  template: `
    <mat-toolbar color="primary">
      <button mat-icon-button (click)="goBack()">
        <mat-icon>arrow_back</mat-icon>
      </button>
      <span>Administrar Usuarios</span>
      <span class="spacer"></span>
      <button mat-icon-button (click)="addNewUser()">
        <mat-icon>person_add</mat-icon>
      </button>
    </mat-toolbar>

    <div class="admin-container">
      <mat-card class="form-card" *ngIf="editingUser">
        <mat-card-header>
          <mat-card-title>
            {{ editingUser.id ? 'Editar Usuario' : 'Nuevo Usuario' }}
          </mat-card-title>
        </mat-card-header>

        <mat-card-content>
          <div class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label>Usuario</mat-label>
              <input matInput [(ngModel)]="editingUser.username" required>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Nombre</mat-label>
              <input matInput [(ngModel)]="editingUser.name" required>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Rol</mat-label>
              <mat-select [(ngModel)]="editingUser.role">
                <mat-option value="admin">Administrador</mat-option>
                <mat-option value="barista">Barista</mat-option>
                <mat-option value="mesero">Mesero</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Contraseña {{ editingUser.id ? '(opcional)' : '' }}</mat-label>
              <input matInput type="password" [(ngModel)]="editingUser.password">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Confirmar Contraseña</mat-label>
              <input matInput type="password" [(ngModel)]="editingUser.passwordConfirm">
            </mat-form-field>

            <div class="toggle-field">
              <mat-slide-toggle [(ngModel)]="editingUser.active">
                Activo
              </mat-slide-toggle>
            </div>
          </div>
        </mat-card-content>

        <mat-card-actions>
          <button mat-button (click)="cancelEdit()">Cancelar</button>
          <button mat-raised-button color="primary" (click)="saveUser()">
            {{ editingUser.id ? 'Actualizar' : 'Crear' }}
          </button>
        </mat-card-actions>
      </mat-card>

      <div class="users-list">
        <mat-card class="user-item" *ngFor="let user of users">
          <div class="user-content">
            <div class="user-info">
              <h3>{{ user.name }}</h3>
              <p class="username">{{ '@' }}{{ user.username }}</p>
              <div class="details">
                <span class="role" [class.admin]="user.role === 'admin'">
                  {{ roleLabel(user.role) }}
                </span>
                <span class="status" [class.active]="user.active" [class.inactive]="!user.active">
                  {{ user.active ? 'Activo' : 'Inactivo' }}
                </span>
              </div>
              <p class="created">Creado: {{ formatDate(user.createdAt) }}</p>
            </div>

            <div class="user-actions">
              <button mat-icon-button color="primary" (click)="editUser(user)">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="deleteUser(user)">
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          </div>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .spacer { flex: 1; }
    .admin-container { padding: 20px; max-width: 1100px; margin: 0 auto; }
    .form-card { margin-bottom: 24px; }
    .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
    .toggle-field { display: flex; align-items: center; }
    mat-card-actions { display: flex; justify-content: flex-end; gap: 12px; padding: 16px; }
    .users-list { display: flex; flex-direction: column; gap: 12px; }
    .user-item { padding: 14px; }
    .user-content { display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: center; }
    .user-info h3 { margin: 0 0 4px 0; font-size: 18px; }
    .username { margin: 0 0 8px 0; color: rgba(0,0,0,.6); font-size: 13px; }
    .details { display: flex; gap: 10px; margin-bottom: 8px; }
    .role, .status { padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .role { background: #eceff1; color: #455a64; }
    .role.admin { background: #e3f2fd; color: #1565c0; }
    .status.active { background: #e8f5e9; color: #2e7d32; }
    .status.inactive { background: #ffebee; color: #c62828; }
    .created { margin: 0; color: rgba(0,0,0,.55); font-size: 12px; }
    .user-actions { display: flex; flex-direction: column; gap: 8px; }
    @media (max-width: 768px) {
      .admin-container { padding: 12px; }
      .user-content { grid-template-columns: 1fr; }
      .user-actions { flex-direction: row; justify-content: flex-end; }
      .form-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class UsersAdminComponent implements OnInit {
  users: User[] = [];
  editingUser: UserForm | null = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router,
    private uiDialog: UiDialogService,
    private snackBar: MatSnackBar
  ) {}

  async ngOnInit() {
    await this.loadUsers();
  }

  async loadUsers() {
    const rows = await firstValueFrom(this.http.get<any[]>(buildApiUrl('users')));
    const allUsers: User[] = (rows || []).map(row => ({
      id: row.id,
      username: row.username,
      password: row.password,
      name: row.name,
      role: row.role,
      active: row.active !== false,
      createdAt: row.createdAt ? new Date(row.createdAt) : new Date()
    }));

    this.users = allUsers.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });
  }

  addNewUser() {
    this.editingUser = {
      username: '',
      name: '',
      role: 'mesero',
      password: '',
      passwordConfirm: '',
      active: true
    };
  }

  editUser(user: User) {
    this.editingUser = {
      ...user,
      password: '',
      passwordConfirm: ''
    };
  }

  cancelEdit() {
    this.editingUser = null;
  }

  async saveUser() {
    if (!this.editingUser) return;

    const username = this.editingUser.username.trim();
    const name = this.editingUser.name.trim();
    const password = this.editingUser.password || '';
    const passwordConfirm = this.editingUser.passwordConfirm || '';

    if (!username || !name) {
      this.snackBar.open('Nombre y usuario son obligatorios', 'Cerrar', { duration: 2500 });
      return;
    }

    const existing = this.users.find(user => user.username.toLowerCase() === username.toLowerCase());
    if (existing && existing.id !== this.editingUser.id) {
      this.snackBar.open('Ese usuario ya existe', 'Cerrar', { duration: 2500 });
      return;
    }

    const isCreate = !this.editingUser.id;
    if (isCreate && !password) {
      this.snackBar.open('La contraseña es obligatoria al crear', 'Cerrar', { duration: 2500 });
      return;
    }

    if (password || passwordConfirm) {
      if (password.length < 4) {
        this.snackBar.open('La contraseña debe tener al menos 4 caracteres', 'Cerrar', { duration: 2500 });
        return;
      }
      if (password !== passwordConfirm) {
        this.snackBar.open('La confirmación de contraseña no coincide', 'Cerrar', { duration: 2500 });
        return;
      }
    }

    if (!this.canChangeAdminState(this.editingUser)) {
      this.snackBar.open('Debe existir al menos un administrador activo', 'Cerrar', { duration: 3000 });
      return;
    }

    try {
      if (isCreate) {
        await firstValueFrom(this.http.post(buildApiUrl('users'), {
          username,
          name,
          role: this.editingUser.role,
          active: this.editingUser.active,
          password
        }));
        this.snackBar.open('Usuario creado', 'Cerrar', { duration: 2000 });
      } else {
        const updateData: Partial<User> = {
          username,
          name,
          role: this.editingUser.role,
          active: this.editingUser.active
        };
        if (password) {
          updateData.password = password;
        }
        await firstValueFrom(this.http.put(buildApiUrl('users/' + this.editingUser.id), updateData));
        this.snackBar.open('Usuario actualizado', 'Cerrar', { duration: 2000 });
      }

      this.editingUser = null;
      await this.loadUsers();
    } catch (error) {
      console.error('Error al guardar usuario:', error);
      this.snackBar.open('Error al guardar usuario', 'Cerrar', { duration: 3000 });
    }
  }

  async deleteUser(user: User) {
    if (!user.id) return;

    const confirmed = await this.uiDialog.confirm({
      title: 'Eliminar usuario',
      message: `�Eliminar usuario ${user.username}?`,
      confirmText: 'Eliminar'
    });
    if (!confirmed) return;

    if (user.role === 'admin' && this.activeAdminCount() <= 1) {
      this.snackBar.open('No puedes eliminar al último administrador activo', 'Cerrar', { duration: 3000 });
      return;
    }

    const current = this.authService.getCurrentUser();
    if (current?.id === user.id) {
      this.snackBar.open('No puedes eliminar tu propio usuario en sesión', 'Cerrar', { duration: 3000 });
      return;
    }

    try {
      await firstValueFrom(this.http.delete(buildApiUrl('users/' + user.id)));
      this.snackBar.open('Usuario eliminado', 'Cerrar', { duration: 2000 });
      await this.loadUsers();
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      this.snackBar.open('Error al eliminar usuario', 'Cerrar', { duration: 3000 });
    }
  }

  private canChangeAdminState(form: UserForm): boolean {
    if (form.role === 'admin' && form.active) return true;
    if (form.id === undefined) return true;

    const original = this.users.find(user => user.id === form.id);
    if (!original) return true;
    if (original.role !== 'admin') return true;
    if (form.role === 'admin' && form.active) return true;

    return this.activeAdminCount(form.id) > 0;
  }

  private activeAdminCount(excludeId?: number): number {
    return this.users.filter(user => user.role === 'admin' && user.active && user.id !== excludeId).length;
  }

  roleLabel(role: User['role']): string {
    if (role === 'admin') return 'Administrador';
    if (role === 'barista') return 'Barista';
    return 'Mesero';
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleString('es-MX');
  }

  goBack() {
    this.router.navigate(['/pos']);
  }
}










