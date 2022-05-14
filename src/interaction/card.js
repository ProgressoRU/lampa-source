import Template from './template'
import Api from './api'
import Arrays from '../utils/arrays'
import Select from './select'
import Favorite from '../utils/favorite'
import Controller from './controller'
import Account from '../utils/account'
import Storage from '../utils/storage'
import Utils from '../utils/math'
import VideoQuality from '../utils/video_quality'
import Timetable from '../utils/timetable'
import Timeline from './timeline'

function create(data, params = {}){
    Arrays.extend(data,{
        title: data.name,
        original_title: data.original_name,
        release_date: data.first_air_date 
    })

    data.release_year = ((data.release_date || '0000') + '').slice(0,4)

    let card  = Template.get(params.isparser ? 'card_parser' : 'card',data)
    let img   = card.find('img')[0] || {}
    let quality = VideoQuality.get(data)

    if(data.first_air_date){
        card.find('.card__view').append('<div class="card__type"></div>')
        card.find('.card__type').text(data.first_air_date ? 'TV' : 'MOV')
        card.addClass(data.first_air_date ? 'card--tv' : 'card--movie')
    }
    

    if(params.card_small){
        card.addClass('card--small')

        if(!Storage.field('light_version')){
            card.find('.card__title').remove()
            card.find('.card__age').remove()
        }
    }

    if(params.card_category){
        card.addClass('card--category')

        card.find('.card__age').remove()
    }

    if(params.card_collection){
        card.addClass('card--collection')

        card.find('.card__age').remove()
    }

    if(params.card_wide){
        card.addClass('card--wide')

        data.poster = data.cover

        if(data.promo) card.append('<div class="card__promo"><div class="card__promo-text">'+data.promo+'</div></div>')

        if(Storage.field('light_version'))
            card.find('.card__title').remove()
        card.find('.card__age').remove()
    }

    if(data.release_year == '0000'){
        card.find('.card__age').remove()
    }

    if(data.check_new_episode && Account.working()){
        let notices = Storage.get('account_notice',[]).filter(n=>n.card_id == data.id)

        if(notices.length){
            let notice = notices[0]

            if(Utils.parseTime(notice.date).full == Utils.parseTime(Date.now()).full){
                card.find('.card__view').append('<div class="card__new-episode"><div>Новая серия</div></div>')
            }
        }
    }

    if(quality){
        card.find('.card__view').append('<div class="card__quality"><div>'+quality+'</div></div>')
    }

    this.image = function(){
        img.onload = function(){
            card.addClass('card--loaded')
        }
    
        img.onerror = function(e){
            img.src = './img/img_broken.svg'
        }
    }

    this.addicon = function(name){
        card.find('.card__icons-inner').append('<div class="card__icon icon--'+name+'"></div>')
    }

    this.watched = function(){
        if(!this.watched_checked){
            let episodes = Timetable.get(data)
            let viewed

            episodes.forEach(ep=>{
                let hash = Utils.hash([ep.season_number,ep.episode_number,data.original_title].join(''))
                let view = Timeline.view(hash)

                if(view.percent) viewed = {ep, view}
            })

            if(viewed){
                let next = episodes.slice(episodes.indexOf(viewed.ep)).filter(ep=>{
                    let date = new Date(ep.air_date).getTime()

                    return date < Date.now()
                }).slice(0,5)

                let wrap = Template.get('card_watched',{})

                next.forEach(ep=>{
                    let item = $('<div class="card-watched__item"><span>'+ep.episode_number+' - '+(ep.name || 'Без названия')+'</span></div>')

                    if(ep == viewed.ep) item.append(Timeline.render(viewed.view))

                    wrap.find('.card-watched__body').append(item)
                })

                this.watched_wrap = wrap

                card.find('.card__view').prepend(wrap)
            }

            this.watched_checked = true
        }

        if(this.watched_wrap){
            this.watched_wrap.toggleClass('reverce--position', card.offset().left > (window.innerWidth / 2) ? true : false)
        }
    }

    this.favorite = function(){
        let status = Favorite.check(data)

        card.find('.card__icon').remove()

        if(status.book) this.addicon('book')
        if(status.like) this.addicon('like')
        if(status.wath) this.addicon('wath')
        if(status.history) this.addicon('history')
    }

    this.onMenu = function(target, data){
        let enabled = Controller.enabled().name
        let status  = Favorite.check(data)

        Select.show({
            title: 'Действие',
            items: [
                {
                    title: status.book ? 'Убрать из закладок' : 'В закладки',
                    subtitle: 'Смотрите в меню (Закладки)',
                    where: 'book'
                },
                {
                    title: status.like ? 'Убрать из понравившихся' : 'Нравится',
                    subtitle: 'Смотрите в меню (Нравится)',
                    where: 'like'
                },
                {
                    title: status.wath ? 'Убрать из ожидаемых' : 'Смотреть позже',
                    subtitle: 'Смотрите в меню (Позже)',
                    where: 'wath'
                },
                {
                    title: status.history ? 'Убрать из истории' : 'Добавить в историю',
                    subtitle: 'Смотрите в меню (История)',
                    where: 'history'
                }
            ],
            onBack: ()=>{
                Controller.toggle(enabled)
            },
            onSelect: (a)=>{
                if(params.object) data.source = params.object.source

                Favorite.toggle(a.where, data)

                this.favorite()

                Controller.toggle(enabled)
            }
        })
    }

    this.create = function(){
        this.favorite()

        card.on('hover:focus',(e)=>{
            this.watched()

            this.onFocus(e.target, data)
        }).on('hover:enter',(e)=>{
            this.onEnter(e.target, data)
        }).on('hover:long',(e)=>{
            this.onMenu(e.target, data)
        })

        this.image()
    }

    this.visible = function(){
        if(this.visibled) return

        if(data.poster_path) img.src = Api.img(data.poster_path)
        else if(data.poster) img.src = data.poster
        else if(data.img)    img.src = data.img
        else img.src = './img/img_broken.svg'

        this.visibled = true
    }

    this.destroy = function(){
        img.onerror = ()=>{}
        img.onload = ()=>{}

        img.src = ''

        card.remove()

        card = null

        img = null
    }

    this.render = function(){
        return card
    }
}

export default create