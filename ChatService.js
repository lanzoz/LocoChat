import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

let stompClient = null;

export const connectWebSocket = (roomId, onMessageReceived) => {
    const socket = new SockJS('http://localhost:8080/loco-chat');
    stompClient = new Client({
        webSocketFactory: () => socket,
        onConnect: () => {
            console.log('Connected to Kotlin Backend');
            stompClient.subscribe(`/topic/room/${roomId}`, (payload) => {
                const message = JSON.parse(payload.body);
                onMessageReceived(message);
            });
        },
    });

    stompClient.activate();
};

export const sendMessage = (roomId, messageData) => {
    if (stompClient && stompClient.connected) {
        stompClient.publish({
            destination: `/app/chat/${roomId}`,
            body: JSON.stringify(messageData)
        });
    }
};