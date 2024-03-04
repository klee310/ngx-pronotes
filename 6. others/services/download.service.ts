import { Injectable, Inject } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { Observable, tap } from 'rxjs'
import { SAVER, Saver } from './saver.provider'
import { download, Download } from './download'

@Injectable({ providedIn: 'root' })
export class DownloadService {

  constructor(private http: HttpClient, @Inject(SAVER) private save: Saver) { }

  download(url: string, filename?: string): Observable<Download> {
    return this.http
      .get(url, { reportProgress: true, observe: 'events', responseType: 'blob' })
      .pipe(download((blob: any) => this.save(blob, filename)))
  }

  downloadEx(url: string, data: any, filename?: string): Observable<Download> {
    return this.http
      .post(url, data, { reportProgress: true, observe: 'events', responseType: 'blob' })
      .pipe(download((blob: any) => this.save(blob, filename)))
  }

  downloadFileName(url: string): Observable<Blob> {
    return this.http.get(url, { responseType: 'blob',observe: 'response'}).pipe(
      tap((response: any) => {
        const contentDispositionHeader = response?.headers?.get('content-disposition')
        if(!contentDispositionHeader) return
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
        const matches = filenameRegex.exec(contentDispositionHeader)
        if (matches && matches?.length !== 0) return this.save(response.body, decodeURIComponent(matches[1]).replace(/['"]/g, ''))
      })
    )
  }

  blob(url: string, filename?: string): Observable<Blob> {
    return this.http
      .get(url, { responseType: 'blob' })
  }
}
