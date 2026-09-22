import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { CalendarModule }           from 'primeng/calendar';
import { CheckboxModule }           from 'primeng/checkbox';
import { ConfirmDialogModule }      from 'primeng/confirmdialog';
import { DialogModule }             from 'primeng/dialog';
import { MessagesModule }           from 'primeng/messages';
import { PanelModule }              from 'primeng/panel';
import { RadioButtonModule }        from 'primeng/radiobutton';
import { InputNumberModule }        from 'primeng/inputnumber';
import { TextareaModule }           from 'primeng/textarea';
import { InputTextModule }          from 'primeng/inputtext';
import { ButtonModule }             from 'primeng/button';

import { AssessmentCtrlComponent }  from './assessment-ctrl.component';
import { ASSESSMENT_API_CLIENT, ASSESSMENT_API_USE_PROXY, AssessmentApiClient } from './assessment-api-client';
import { E24HttpService } from './e24-http.service';
import { E24ProxyHttpService } from './e24-proxy-http.service';

export function assessmentApiClientFactory(
    useProxyApi: boolean,
    proxyService: E24ProxyHttpService,
    directService: E24HttpService
): AssessmentApiClient {

    return useProxyApi ? proxyService : directService;
}

@NgModule({
    declarations: [AssessmentCtrlComponent],
    imports: [
        CommonModule, FormsModule, HttpClientModule,

        CalendarModule, CheckboxModule, ConfirmDialogModule, DialogModule, MessagesModule, PanelModule, RadioButtonModule, InputNumberModule,
        TextareaModule, InputTextModule, ButtonModule
    ],
    providers: [
        {
            provide: ASSESSMENT_API_CLIENT,
            useFactory: assessmentApiClientFactory,
            deps: [ASSESSMENT_API_USE_PROXY, E24ProxyHttpService, E24HttpService]
        }
    ],
    exports: [AssessmentCtrlComponent]
})
export class AssessmentCtrlModule { }
