import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MsalBroadcastService, MsalService } from '@azure/msal-angular';
import { InteractionStatus } from '@azure/msal-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Subject, filter, takeUntil } from 'rxjs';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule, MatMenuModule],
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.scss'],
})
export class NavbarComponent implements OnInit, OnDestroy {
  private msal = inject(MsalService);
  private broadcast = inject(MsalBroadcastService);
  private destroy$ = new Subject<void>();

  accountName: string | null = null;
  isLoggedIn = false;

  ngOnInit(): void {
    this.broadcast.inProgress$
      .pipe(
        filter((status) => status === InteractionStatus.None),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        this.setAccount();
      });
    this.setAccount();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  signIn(): void {
    this.msal.loginRedirect();
  }

  signOut(): void {
    this.msal.logoutRedirect();
  }

  private setAccount(): void {
    const account = this.msal.instance.getActiveAccount() ?? this.msal.instance.getAllAccounts()[0];
    if (account) {
      this.msal.instance.setActiveAccount(account);
      this.accountName = account.name ?? account.username ?? 'Signed in';
      this.isLoggedIn = true;
    } else {
      this.accountName = null;
      this.isLoggedIn = false;
    }
  }
}
