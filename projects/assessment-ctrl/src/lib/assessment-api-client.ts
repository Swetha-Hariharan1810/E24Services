import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { E24InfoHelpTextResponseDto, E24QuestionResponseDto, E24StartResponseDto, E24WorkboxResponse } from './e24.dtos';

export interface AssessmentApiClient {
    beginContinueAssessment(e24url: string, memberId: string, prepop: string, e24MemberId: string, apWorkBoxId: string, e24UrlBase: string): Observable<E24WorkboxResponse>;
    continueAssessment(e24url: string, e24MemberId: string, apWorkBoxId: string, e24UrlBase: string): Observable<E24QuestionResponseDto>;
    startNewAssessment(e24url: string, memberId: string, prepop: string, e24UrlBase: string): Observable<E24StartResponseDto>;
    getFirstQuestion(e24url: string, traversalId: string, e24MemberId: string, e24AlgorithmId: string, language: string, e24UrlBase: string): Observable<E24QuestionResponseDto>;
    navigateToNextQuestion(e24url: string, traversalId: string, e24MemberId: string, e24AlgorithmId: string, e24PreviousQuestionNodeId: number, body: string | undefined, e24UrlBase: string): Observable<E24QuestionResponseDto>;
    navigateToPreviousQuestion(e24url: string, traversalId: string, e24UrlBase: string): Observable<E24QuestionResponseDto>;
    getItemInfoText(e24url: string, traversalId: string, itemId: number, noteType: number, e24UrlBase: string): Observable<E24InfoHelpTextResponseDto>;
    getPostCompleteData(e24url: string, traversalId: string, e24UrlBase: string): Observable<any>;
}

export const ASSESSMENT_API_CLIENT = new InjectionToken<AssessmentApiClient>('ASSESSMENT_API_CLIENT');
export const ASSESSMENT_API_USE_PROXY = new InjectionToken<boolean>('ASSESSMENT_API_USE_PROXY', {
    providedIn: 'root',
    factory: () => true
});