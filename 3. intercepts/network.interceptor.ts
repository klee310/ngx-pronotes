import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse } from "@angular/common/http"
import { Injectable } from '@angular/core';
import * as _ from "lodash";
import { catchError, finalize, from, mergeMap, Observable, tap, throwError, timer } from "rxjs";
import { environment } from "../../../../environments/environment";
import { AuthenticationService } from "./authentication.service";
import { LoaderService } from "./loader.service";
import { Router } from "@angular/router";

@Injectable()
export class NetworkInterceptor implements HttpInterceptor {

  ignoreLoader = [
    // requests in this list will be processed as normal, except the show/hide loader will be skipped
    'api/status/auth',
    'api/settings/case-cycle/poll'
  ];
  ignoreIntercept = [
    // requests in this list will be processed without further intercept-processing (including refresh-token processing)
    'assets/i18n'
  ];

  totalRequests = 0;
  completedRequests = 0;

  constructor(private loader: LoaderService, private authService: AuthenticationService, private router: Router) { }

  includes(collection: any, url: string) {
    return !!(_.find(collection, i => { return url.includes(i) }));
  }

  startsWith(collection: any, url: string) {
    return !!(_.find(collection, i => { return url.startsWith(i) }));
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.includes(this.ignoreIntercept, req.url) || this.startsWith(this.ignoreIntercept, req.url)) {
      return next.handle(req);
    }

    return from(this.authService.getSessionToken()).pipe(mergeMap(val => {
      var storedToken = val;
      if (!this.includes(this.ignoreLoader, req.url) && !this.startsWith(this.ignoreLoader, req.url)) {
        this.totalRequests++;
        this.loader.show();
      }

      if (!!storedToken) {
        req = req.clone({ setHeaders: { Authorization: `Bearer ${storedToken}`, SameSite: 'None', } })
      }

      return next.handle(req).pipe(
        catchError(err => {
          if (err.status == 418) {
            this.router.navigate(['/maintenance'])
          }
          else if (err.status == 403) {
            if (req.url == '/api/auth/login') {
              this.authService.markLoggedOut('Login Failed!');
            }
            else {
              this.authService.markLoggedOut();
            }
          }
          this.checkLoader();
          var errWrap: any = {};
          if (err.error) {
            _.set(errWrap, 'message', err.error);
          }
          else if (err.message) {
            _.set(errWrap, 'message', err.message);
          }
          _.merge(errWrap, {status: err.status, error: err});
          return throwError(() => errWrap);
        }),
        finalize(() => {
          if (!this.includes(this.ignoreLoader, req.url) && !this.startsWith(this.ignoreLoader, req.url)) {
            this.completedRequests++;
            this.checkLoader();
          }
        }),
        tap({
          next: (val: any) => {
            if (val.status == 403) {
              this.authService.markLoggedOut();
            }
            else if (val instanceof HttpResponse && val.headers.has('Authorization')) {
              // each response contains a token; save this token as our session-token if different from what is already stored. refresh-token is automatically performed on server-side. this is the way...
              var auth = val.headers.get('Authorization') as string;
              var respToken = _.trim(_.replace(auth, /^Bearer\s/, ''), '"');
              if (storedToken != respToken) {
                this.authService.setSessionToken(respToken).subscribe();
              }
            }
          },
          error: (err: HttpErrorResponse) => {
            if (err.status == 403) {
              if (!environment.production) console.log('[D] network.intercept 403 - markLoggedOut()');
              this.authService.markLoggedOut();
            }
            else {
              if (!environment.production) console.log('[D]', err);
            }
            this.checkLoader();
          }
        })
      )
    }))
  }

  checkLoader() {
    if (this.completedRequests === this.totalRequests) {
      this.completedRequests = 0;
      this.totalRequests = 0;
      timer(500).subscribe(() => { this.loader.hide(); })
    }
  }
}
