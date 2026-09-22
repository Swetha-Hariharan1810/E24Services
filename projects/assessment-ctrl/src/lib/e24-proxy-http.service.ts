import { Injectable, isDevMode } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { AssessmentApiClient } from './assessment-api-client';
import { E24InfoHelpTextResponseDto, E24QuestionResponseDto, E24StartResponseDto, E24WorkboxResponse } from './e24.dtos';

@Injectable({
    providedIn: 'root'
})
export class E24ProxyHttpService implements AssessmentApiClient {

    private readonly apiRoot: string = '/api/E24Proxy';

    constructor(private _http: HttpClient) {
    }

    public beginContinueAssessment(webserviceUrlBase: string, memberId: string, prepop: string, e24MemberId: string, apWorkBoxId: string, e24UrlBase: string): Observable<E24WorkboxResponse> {

        const url: string = this.appendExpert24Query(
            this.buildUrl(webserviceUrlBase, `/begin-continue/${encodeURIComponent(apWorkBoxId)}/${encodeURIComponent(e24MemberId)}`),
            e24UrlBase
        );
        const body = {
            MemberId: memberId,
            Prepop: this.tryParseJson(prepop)
        };

        this.log('beginContinueAssessment url: ' + url);
        return this._http.post<E24WorkboxResponse>(url, body, { headers: this.getHeaders() });
    }

    public continueAssessment(webserviceUrlBase: string, e24MemberId: string, apWorkBoxId: string, e24UrlBase: string): Observable<E24QuestionResponseDto> {

        const url: string = this.appendExpert24Query(
            this.buildUrl(webserviceUrlBase, `/continue/${encodeURIComponent(apWorkBoxId)}/${encodeURIComponent(e24MemberId)}`),
            e24UrlBase
        );

        this.log('continueAssessment url: ' + url);
        return this._http.get<E24QuestionResponseDto>(url, { headers: this.getHeaders() });
    }

    public startNewAssessment(webserviceUrlBase: string, memberId: string, prepop: string, e24UrlBase: string): Observable<E24StartResponseDto> {

        const url: string = this.appendExpert24Query(this.buildUrl(webserviceUrlBase, '/start'), e24UrlBase);
        const body = {
            MemberId: memberId,
            Prepop: this.tryParseJson(prepop)
        };

        this.log('startNewAssessment url: ' + url);
        return this._http.post<E24StartResponseDto>(url, body, { headers: this.getHeaders() });
    }

    public getFirstQuestion(webserviceUrlBase: string, traversalId: string, e24MemberId: string, e24AlgorithmId: string, language: string, e24UrlBase: string): Observable<E24QuestionResponseDto> {

        const normalizedLanguage = language ? encodeURIComponent(language) : '';
        const languageQuery = normalizedLanguage.length > 0 ? `?language=${normalizedLanguage}` : '';

        const url: string = this.appendExpert24Query(this.buildUrl(
            webserviceUrlBase,
            `/first/${encodeURIComponent(traversalId)}/${encodeURIComponent(e24MemberId)}/${encodeURIComponent(e24AlgorithmId)}${languageQuery}`
        ), e24UrlBase);

        this.log('getFirstQuestion url: ' + url);
        return this._http.post<E24QuestionResponseDto>(url, {}, { headers: this.getHeaders() });
    }

    public navigateToNextQuestion(webserviceUrlBase: string, traversalId: string, e24MemberId: string, e24AlgorithmId: string, e24PreviousQuestionNodeId: number, body: string | undefined, e24UrlBase: string): Observable<E24QuestionResponseDto> {

        const url: string = this.appendExpert24Query(
            this.buildUrl(
                webserviceUrlBase,
                `/next/${encodeURIComponent(traversalId)}/${encodeURIComponent(e24MemberId)}/${encodeURIComponent(e24AlgorithmId)}/${e24PreviousQuestionNodeId}`
            ),
            e24UrlBase
        );

        const requestBody = this.tryParseJson(body) || {};

        this.log('navigateToNextQuestion url: ' + url);
        return this._http.post<E24QuestionResponseDto>(url, requestBody, { headers: this.getHeaders() });
    }

    public navigateToPreviousQuestion(webserviceUrlBase: string, traversalId: string, e24UrlBase: string): Observable<E24QuestionResponseDto> {

        const url: string = this.appendExpert24Query(
            this.buildUrl(webserviceUrlBase, `/previous/${encodeURIComponent(traversalId)}`),
            e24UrlBase
        );

        this.log('navigateToPreviousQuestion url: ' + url);
        return this._http.get<E24QuestionResponseDto>(url, { headers: this.getHeaders() });
    }

    public getItemInfoText(webserviceUrlBase: string, traversalId: string, itemId: number, noteType: number, e24UrlBase: string): Observable<E24InfoHelpTextResponseDto> {

        const url: string = this.appendExpert24Query(
            this.buildUrl(webserviceUrlBase, `/info/${encodeURIComponent(traversalId)}/${noteType}/${itemId}`),
            e24UrlBase
        );

        this.log('getItemInfoText url: ' + url);
        return this._http.get<E24InfoHelpTextResponseDto>(url, { headers: this.getHeaders() });
    }

    public getPostCompleteData(webserviceUrlBase: string, traversalId: string, e24UrlBase: string): Observable<any> {

        const url: string = this.appendExpert24Query(
            this.buildUrl(webserviceUrlBase, `/qa/${encodeURIComponent(traversalId)}`),
            e24UrlBase
        );

        this.log('getPostCompleteData url: ' + url);
        return this._http.get<any>(url, { headers: this.getHeaders() });
    }

    private buildUrl(baseUrl: string, route: string): string {

        const normalizedBaseUrl = (baseUrl ?? '').trim().replace(/\/+$/, '');
        return `${normalizedBaseUrl}${this.apiRoot}${route}`;
    }

    private appendExpert24Query(url: string, webserviceUrlBase?: string): string {

        const normalized = this.normalizeOptionalUrl(webserviceUrlBase);

        if (!normalized) {
            return url;
        }

        const hasQuery = url.indexOf('?') >= 0;
        const separator = hasQuery ? '&' : '?';
        return `${url}${separator}expert24urlBase=${encodeURIComponent(normalized)}`;
    }

    private normalizeOptionalUrl(value?: string): string | undefined {

        if (!value) {
            return undefined;
        }

        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }

    private tryParseJson(value: string | undefined | null): any {

        if (value === null || value === undefined || value.trim().length === 0) {
            return undefined;
        }

        try {
            return JSON.parse(value);
        } catch {
            this.log('Could not parse JSON payload. Sending empty object payload instead.');
            return {};
        }
    }

    public getHeaders() {

        return new HttpHeaders().set('Content-Type', 'application/json');
    }

    private log(message: string, data?: any) {

        if (isDevMode()) {
            if (data !== undefined) {
                console.log(message, data);
            } else {
                console.log(message);
            }
        }
    }
}
