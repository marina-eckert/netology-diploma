import { Icon } from "../ui/Icon";

export function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="art-circle" />
      <div className="art-star">✦</div>
      <div className="art-spark">✳</div>
      <div className="art-plant">
        <span />
        <span />
        <span />
        <i />
      </div>
      <div className="art-book book-a">
        <span>
          МИР
          <br />
          ВНУТРИ
          <br />
          КНИГИ
        </span>
        <Icon size={48} />
      </div>
      <div className="art-book book-b">
        <span>
          ещё
          <br />
          одна
          <br />
          глава
        </span>
      </div>
      <div className="art-stack s1" />
      <div className="art-stack s2" />
      <div className="art-stack s3" />
      <div className="art-caption">
        Ваша следующая история
        <br />
        начинается здесь ↗
      </div>
    </div>
  );
}
