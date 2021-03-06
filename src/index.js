import { spawn } from 'child_process';
import path from 'path';
import StateMachine from 'nodejs-state-machine';
import { Bot, ConsoleBot, MemorySessionStore } from 'bottender';
import { createServer } from 'bottender/express';
import WebConnector from './bot/WebConnector';
import config from './config';

const bot = new Bot({
    connector: new WebConnector({ fallbackMethods: true }),
    sync: true
});

// Bot will use memory session store as default if you don't assign sessionStore.
bot.setInitialState({
    faq: null
});

const newFaq = () => new StateMachine('start', {
    transitions: [
        {
            name: 'applyPayment',
            from: ['start', '__label__payment', '__label__creditcard'],
            to: '__label__payment'
        },
        { name: 'applyEmail', from: '__label__payment', to: 'start' },
        {
            name: 'applyAddress',
            from: '__label__payment',
            to: 'start'
        },
        {
            name: 'applyCreditcard',
            from: ['start', '__label__creditcard'],
            to: '__label__creditcard'
        },
        {
            name: 'applyCreditcard',
            from: ['start', '__label__creditcard', '__label__payment'],
            to: '__label__creditcard'
        },
        { name: 'applyFormalcard', from: '__label__creditcard', to: 'start' },
        {
            name: 'applyBackcard',
            from: '__label__creditcard',
            to: 'start'
        }
    ],
    handlers: {
        onApplyPayment: () => ({
            text: `申請帳單可以使用以下方式:`,
            options: [
                '1.電子帳單',
                '2.實體帳單'
            ]
        }),
        onApplyEmail: () => ({
            text: `(1)您如果是本行網路銀行客戶，可選擇直接上網辦理申請
            (2)您如果尚未成為本行網路銀行客戶，則可選擇先備妥您的信用卡卡號，註冊為網路銀行客戶後，直接上網辦理申請電子信用卡帳單。 (註冊網銀客戶與電子帳單服務僅限信用卡正卡持卡人)。
            (3)如果客戶不欲註冊網銀，亦可由客服人員幫其設定。`
        }),
        onApplyAddress: () => ({
            text: `您可透過語音或透過客服人員補寄本期或申請1年半內的帳單(補寄3個月以前帳單，每個月份發補手續費100元)`
        }),
        onApplyCreditcard: () => ({
            text: '請問您想申請的信用卡是：',
            options: [
                '1.正卡',
                '2.附卡'
            ]
        }),
        onApplyFormalcard: () => ({
            text: `首次申請信用卡正卡須年滿20歲（鼎極卡須年滿24歲），請備妥申請人身分證正反面影本、財力證明文件，即可申辦。`
        }),
        onApplyBackcard: () => ({
            text: `申請他人信用卡附卡，須年滿 15 歲，且為正卡之配偶、父母、子女、兄弟姊妹及配偶之父母，請備妥附卡申請人身分證正反面影本、可佐證正附卡關係之證明文件，如正卡人之身份證影本及戶籍謄本(毋需附財力資料)。`
        })
    }
});
bot.onEvent(async context => {
    if (context.state.faq === null) {
        context.setState({ faq: newFaq()})
    }
    const { text: label } = context.event;
    const { faq } = context.state;
    const labelSlot = {
        __label__payment: async () => await faq.applyPayment(),
        __label__email: async () => await faq.applyEmail(),
        __label__address: async () => await faq.applyAddress(),
        __label__creditcard: async () => await faq.applyCreditcard(),
        __label__creditcard_formal: async () => await faq.applyFormalcard(),
        __label__creditcard_back: async () => await faq.applyBackcard(),
        default: async () => await context.resetState()
    };

    if (!labelSlot.hasOwnProperty(label)) context.response.body = '';
    else context.response.body = await labelSlot[label]();
});
const server = createServer(bot);

server.listen(config.port, () => {
    console.log('server is running on ', config.port, ' port...');
});
