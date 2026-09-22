import { Injectable,  isDevMode  } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { AssessmentApiClient } from './assessment-api-client';
import { E24InfoHelpTextResponseDto, E24QuestionResponseDto, E24StartDto, E24StartResponseDto, E24WorkboxResponse } from './e24.dtos';

@Injectable({
    providedIn: 'root'
})
export class E24HttpService implements AssessmentApiClient {

    private e24BeginContinueApi: string     = '/webbuilder/TraversalService/Prepop/{traversalId}/{e24MemberId}';
    private e24ContinueApi: string          = '/webbuilder/TraversalService/GoBack/{traversalId}/{e24MemberId}/0/-1';
    private e24StartApi: string             = '/webbuilder/TraversalService/Member';
    private e24FirstQuestionApi: string     = '/webbuilder/TraversalService/First/{traversalId}/{e24MemberId}/{e24AlgorithmId}/0?Language={language}';
    private e24NextQuestionApi: string      = '/webbuilder/TraversalService/Next/{traversalId}/{e24MemberId}/{e24AlgorithmId}/{e24PreviousQuestionNodeId}';
    private e24PreviousQuestionApi: string  = '/webbuilder/TraversalService/Previous/{traversalId}';
    private e24HelpInfoApi: string          = '/webbuilder/TraversalService/Info/{traversalId}/{noteType}/{itemId}';
    private e24PostCompleteApi: string      = '/webbuilder/TraversalService/QA/{traversalId}';
    
    constructor(private _http: HttpClient) {
    }

    

    public beginContinueAssessment(e24url: string, memberId: string, prepop: string, e24MemberId: string, apWorkBoxId: string): Observable<E24WorkboxResponse> {

        let url: string = e24url + this.e24BeginContinueApi.replace('{traversalId}', apWorkBoxId).replace('{e24MemberId}', e24MemberId);

        this.log('beginContinueAssessment url: ' + url);

        let prepopDto: E24StartDto = new E24StartDto();
        prepopDto['@UserID'] = memberId;
        prepopDto.callback = 'raw';

        if (prepop !== null && prepop !== undefined && prepop.trim().length > 0) {
            prepopDto.Prepop = JSON.parse(prepop);
        }  
        
        let body: string = JSON.stringify(prepopDto);
        
        return this._http.post<E24WorkboxResponse>(url, body, {headers: this.getHeaders()});
    }

    public continueAssessment(e24url: string, e24MemberId: string, apWorkBoxId: string): Observable<E24QuestionResponseDto> {

        let url: string = e24url + this.e24ContinueApi.replace('{traversalId}', apWorkBoxId).replace('{e24MemberId}', e24MemberId);

        this.log('continueAssessment url: ' + url);

        return this._http.get<E24QuestionResponseDto>(url, {headers: this.getHeaders()});
    }

    public startNewAssessment(e24url: string, memberId: string, prepop: string): Observable<E24StartResponseDto> {

        let url: string = e24url + this.e24StartApi;

        let prepopDto: E24StartDto = new E24StartDto();
        prepopDto['@UserID'] = memberId;
        prepopDto.callback = 'raw';

        if (prepop !== null && prepop !== undefined && prepop.trim().length > 0) {
            prepopDto.Prepop = JSON.parse(prepop);
        }  
        
        let body: string = JSON.stringify(prepopDto);
        
        return this._http.post<E24StartResponseDto>(url, body, {headers: this.getHeaders()});
    }

    public getFirstQuestion(e24url: string, traversalId: string, e24MemberId: string, e24AlgorithmId: string, language: string): Observable<E24QuestionResponseDto> {

        // E24 logic: MEMBER == English, SPANISH == Spanish
        if (language === null || language === undefined) {
        
            language = 'MEMBER';
        
        } else {

            if (language.toLowerCase() === 'spa' || language.toLowerCase() === 'spanish') {
                language = 'SPANISH'; 
            } else {
                language = 'MEMBER';
            }
        }

        let url: string = e24url + this.e24FirstQuestionApi
            .replace('{traversalId}', traversalId)
            .replace('{e24MemberId}', e24MemberId)
            .replace('{e24AlgorithmId}', e24AlgorithmId)    
            .replace('{language}', language);

        return this._http.post<E24QuestionResponseDto>(url, '{}', {headers: this.getHeaders()});
    }

    public navigateToNextQuestion(e24url: string, traversalId: string, e24MemberId: string, e24AlgorithmId: string, e24PreviousQuestionNodeId: number, body: string | undefined): Observable<E24QuestionResponseDto> {
        
        let url: string = e24url + this.e24NextQuestionApi
            .replace('{traversalId}', traversalId)
            .replace('{e24MemberId}', e24MemberId)
            .replace('{e24AlgorithmId}', e24AlgorithmId)    
            .replace('{e24PreviousQuestionNodeId}', String(e24PreviousQuestionNodeId));

        if (body !== undefined && body !== null) {

            return this._http.post<E24QuestionResponseDto>(url, body, {headers: this.getHeaders()});

        } else {

            return this._http.post<E24QuestionResponseDto>(url, '{}', {headers: this.getHeaders()});
        }
    }

    public navigateToPreviousQuestion(e24url: string, traversalId: string): Observable<E24QuestionResponseDto> {

        let url: string = e24url + this.e24PreviousQuestionApi.replace('{traversalId}', traversalId);

        return this._http.get<E24QuestionResponseDto>(url, {headers: this.getHeaders()});
    }

    public getItemInfoText(e24url: string, traversalId: string, itemId: number, noteType: number): Observable<E24InfoHelpTextResponseDto> {

        let url: string = e24url + this.e24HelpInfoApi
            .replace('{traversalId}', traversalId)
            .replace('{noteType}', String(noteType))
            .replace('{itemId}', String(itemId));

        return this._http.get<E24InfoHelpTextResponseDto>(url, {headers: this.getHeaders()});
    }

    public getPostCompleteData(e24url: string, traversalId: string): Observable<any> {

        let url: string = e24url + this.e24PostCompleteApi.replace('{traversalId}', traversalId);

        return this._http.get<any>(url, {headers: this.getHeaders()});
        // return this._http.get<any>(url);
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
